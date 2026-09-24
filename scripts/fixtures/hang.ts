// A suite that never finishes, for scripts/test-browser-runner.ts. It
// prints one line first, so the test can prove the runner reports what a
// hung child had already written.
console.log("started, and will now hang");
setInterval(() => {}, 1000);
