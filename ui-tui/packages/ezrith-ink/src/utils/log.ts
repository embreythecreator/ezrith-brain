export function logError(error: unknown): void {
  if (!process.env.EZRITH_INK_DEBUG_ERRORS) {
    return
  }

  console.error(error)
}
