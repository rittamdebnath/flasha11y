#!/usr/bin/env node
import { Command } from 'commander';
import { buildConfig } from './config.js';
import { walkExports, groupScreens, loadContext } from './scanner/index.js';
import { runAnalysisBatch } from './analysis/index.js';
import {
  deduplicateFindings,
  mergeAndPrioritize,
} from './cross-screen/index.js';
import { generateJsonReport, generateMarkdownReport } from './reporting/index.js';
import { annotateScreenImages } from './annotator/index.js';
import { createLogger } from './utils/logger.js';
import { ensureDir } from './utils/file.js';

const program = new Command();

program
  .name('flashA11Y')
  .description('Design Accessibility & UX Audit Agent — analyze Figma exports with Claude Vision')
  .version('0.1.0')
  .option('-e, --exports <path>', 'Path to exports folder', './exports')
  .option('-c, --context <path>', 'Path to context folder', './context')
  .option('-o, --output <path>', 'Output directory', './output')
  .option('-m, --model <model>', 'Claude or Gemini model', 'claude-sonnet-4-6')
  .option('--concurrency <n>', 'Parallel requests', '5')
  .option('--batch-threshold <n>', 'Use Batches API above N screens', '50')
  .option('--no-boost', 'Disable company-rule severity boosting')
  .option('-v, --verbose', 'Verbose logging')
  .option('--json-only', 'Output only JSON report')
  .option('--md-only', 'Output only Markdown report')
  .action(async (opts) => {
    const config = buildConfig(opts);
    const logger = createLogger(config.verbose);
    const startTime = Date.now();

    console.log('\n🔍  flashA11Y — Design Accessibility & UX Audit Agent\n');

    try {
      // Phase 1: Scan
      logger.info('Scanning exports directory...');
      const files = await walkExports(config.exportsPath);
      if (files.length === 0) {
        logger.error(`No supported image files found in ${config.exportsPath}`);
        logger.info('Supported formats: PNG, JPEG');
        logger.info('Expected structure: exports/{mobile,tablet,desktop,flows,states}/');
        process.exit(1);
      }
      console.log(`   Found ${files.length} screen(s) in exports/`);

      const groups = groupScreens(files);
      console.log(`   Grouped into ${groups.length} analysis unit(s)`);
      console.log(`     - Individual screens: ${groups.filter((g) => g.type === 'individual').length}`);
      console.log(`     - Flows: ${groups.filter((g) => g.type === 'flow').length}`);
      console.log(`     - State variants: ${groups.filter((g) => g.type === 'states').length}`);
      console.log(`     - Cross-device groups: ${groups.filter((g) => g.type === 'cross-device').length}`);

      // Phase 2: Load context
      logger.info('Loading design context...');
      const designContext = await loadContext(config.contextPath);
      if (designContext.severityRules?.length) {
        console.log(`   Loaded ${designContext.severityRules.length} company severity rule(s)`);
      }
      if (designContext.accessibilityGuidelines) {
        console.log('   Accessibility guidelines loaded');
      }

      // Phase 3: Analyze
      logger.info('Starting analysis via Claude Vision API...');
      console.log(`\n   Analyzing with ${config.model} (concurrency: ${config.concurrency})...\n`);

      const batchResults = await runAnalysisBatch(groups, designContext, config, logger);

      // Phase 4: Cross-screen processing
      logger.info('Processing cross-screen analysis...');
      const { merged, unique } = deduplicateFindings(batchResults.screenFindings);
      console.log(`   Merged ${merged.length} duplicate finding(s) across screens`);

      const companyOverrides = designContext.severityRules || [];
      const { allFindings, priorities } = mergeAndPrioritize(
        unique,
        batchResults.flowFindings,
        batchResults.crossDeviceFindings,
        merged,
        companyOverrides,
        config.noBoost,
      );

      const overridesApplied = allFindings.filter((f) => f.isCompanyRule).length;
      console.log(`   ${overridesApplied} company rule override(s) applied`);

      // Phase 5: Generate reports
      logger.info('Generating reports...');
      await ensureDir(config.outputPath);

      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
      const reportInputs = {
        screenFindings: unique,
        flowFindings: batchResults.flowFindings,
        crossDeviceFindings: batchResults.crossDeviceFindings,
        mergedFindings: merged,
        priorities,
        metadata: {
          screensAnalyzed: files.length,
          totalCost: batchResults.totalCost,
          duration,
          modelUsed: config.model,
          companyRuleOverridesApplied: overridesApplied,
        },
      };

      if (!config.mdOnly) {
        const jsonPath = await generateJsonReport(reportInputs, config.outputPath);
        console.log(`\n   ✅  JSON report: ${jsonPath}`);
      }

      if (!config.jsonOnly) {
        const mdPath = await generateMarkdownReport(
          {
            ...reportInputs,
            flowsCount: groups.filter((g) => g.type === 'flow').length,
            crossDeviceCount: groups.filter((g) => g.type === 'cross-device').length,
          },
          config.outputPath,
        );
        console.log(`   ✅  Markdown report: ${mdPath}`);
      }

      // Phase 6: Annotated images
      logger.info('Generating annotated images...');
      const annotatedPaths = await annotateScreenImages(unique, {
        outputDir: config.outputPath,
        exportsDir: config.exportsPath,
      });
      console.log(`   ✅  ${annotatedPaths.length} annotated image(s) generated`);

      // Final summary
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  Audit Complete');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Screens analyzed:  ${files.length}`);
      console.log(`  Total findings:    ${allFindings.length}`);
      console.log(`  Critical: ${allFindings.filter((f) => f.severity === 'critical').length}  ` +
        `High: ${allFindings.filter((f) => f.severity === 'high').length}  ` +
        `Medium: ${allFindings.filter((f) => f.severity === 'medium').length}  ` +
        `Low: ${allFindings.filter((f) => f.severity === 'low').length}`);
      console.log(`  Duration:          ${duration}`);
      console.log(`  Cost:              $${batchResults.totalCost.toFixed(4)}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Exit with code 2 if critical findings exist
      const hasCritical = allFindings.some((f) => f.severity === 'critical');
      process.exit(hasCritical ? 2 : 0);
    } catch (err) {
      logger.error(`Fatal error: ${err}`);
      process.exit(1);
    }
  });

program.parse();
