export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startLogoScheduler } = await import("./lib/logo/scheduler");
  startLogoScheduler();
}
