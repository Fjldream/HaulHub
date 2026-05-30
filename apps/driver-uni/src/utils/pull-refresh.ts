export async function finishPullRefresh(task: () => Promise<void> | void) {
  try {
    await task();
  } finally {
    uni.stopPullDownRefresh();
  }
}
