import { v4 as uuidv4 } from 'uuid';
import type { ScannedFile, ScreenGroup, DeviceCategory } from '../types/exports.js';

export function groupScreens(files: ScannedFile[]): ScreenGroup[] {
  const groups: ScreenGroup[] = [];

  // Group 1: Individual screens by device
  const deviceFiles = files.filter(
    (f) => f.screenType === 'screen' && f.deviceCategory
  );
  const byDevice = new Map<DeviceCategory, ScannedFile[]>();
  for (const file of deviceFiles) {
    const key = file.deviceCategory!;
    if (!byDevice.has(key)) byDevice.set(key, []);
    byDevice.get(key)!.push(file);
  }
  for (const [device, screenList] of byDevice) {
    for (const screen of screenList) {
      groups.push({
        id: uuidv4(),
        screens: [screen],
        type: 'individual',
        name: `${device}/${screen.filename}`,
      });
    }
  }

  // Group 2: Flows
  const flowFiles = files.filter((f) => f.screenType === 'flow');
  const byFlowName = new Map<string, ScannedFile[]>();
  for (const file of flowFiles) {
    const key = file.flowName || 'unnamed-flow';
    if (!byFlowName.has(key)) byFlowName.set(key, []);
    byFlowName.get(key)!.push(file);
  }
  for (const [flowName, flowScreens] of byFlowName) {
    flowScreens.sort((a, b) => (a.flowStep ?? 0) - (b.flowStep ?? 0));
    groups.push({
      id: uuidv4(),
      screens: flowScreens,
      type: 'flow',
      name: `flow: ${flowName}`,
    });
  }

  // Group 3: State variants
  const stateFiles = files.filter((f) => f.screenType === 'state');
  const byBaseAndDevice = new Map<string, ScannedFile[]>();
  for (const file of stateFiles) {
    const key = `${file.deviceCategory ?? 'unknown'}/${file.screenBaseName}`;
    if (!byBaseAndDevice.has(key)) byBaseAndDevice.set(key, []);
    byBaseAndDevice.get(key)!.push(file);
  }
  for (const [name, stateScreens] of byBaseAndDevice) {
    groups.push({
      id: uuidv4(),
      screens: stateScreens,
      type: 'states',
      name: `states: ${name}`,
    });
  }

  // Group 4: Cross-device (same screen name across mobile/tablet/desktop)
  const allNamedScreens = files.filter(
    (f) => f.screenType === 'screen' && f.screenBaseName && f.deviceCategory
  );
  const byBaseName = new Map<string, Map<DeviceCategory, ScannedFile>>();
  for (const file of allNamedScreens) {
    const key = file.screenBaseName!;
    if (!byBaseName.has(key)) byBaseName.set(key, new Map());
    byBaseName.get(key)!.set(file.deviceCategory!, file);
  }
  for (const [baseName, deviceMap] of byBaseName) {
    if (deviceMap.size > 1) {
      groups.push({
        id: uuidv4(),
        screens: [...deviceMap.values()],
        type: 'cross-device',
        name: `cross-device: ${baseName}`,
      });
    }
  }

  return groups;
}
