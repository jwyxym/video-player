/** 锁定横屏。通常需先进入全屏；不支持或被浏览器拒绝时返回 false。 */
export async function lockLandscape(): Promise<boolean> {
  if (typeof screen === 'undefined') return false;
  try {
    const orientation = screen.orientation;
    if (typeof orientation?.lock !== 'function') return false;
    await orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
}

/** 解除方向锁定，恢复设备默认方向行为，并非强制竖屏。 */
export function unlockOrientation(): boolean {
  if (typeof screen === 'undefined') return false;
  try {
    const orientation = screen.orientation;
    if (typeof orientation?.unlock !== 'function') return false;
    orientation.unlock();
    return true;
  } catch {
    return false;
  }
}
