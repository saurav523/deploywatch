import { computeDeploymentHealth } from "../src/services/healthEngine";

describe("computeDeploymentHealth", () => {
  it("returns 100 for a fully healthy deployment", () => {
    const { score, reasons } = computeDeploymentHealth({
      desiredReplicas: 3,
      availableReplicas: 3,
      totalRestarts: 0,
      crashingPods: 0,
      imagePullErrors: 0,
      pendingPods: 0,
    });
    expect(score).toBe(100);
    expect(reasons[0]).toMatch(/no restarts/);
  });

  it("penalizes unavailable replicas", () => {
    const { score, reasons } = computeDeploymentHealth({
      desiredReplicas: 3,
      availableReplicas: 1,
      totalRestarts: 0,
      crashingPods: 0,
      imagePullErrors: 0,
      pendingPods: 0,
    });
    expect(score).toBeLessThan(100);
    expect(reasons.some((r) => r.includes("unavailable"))).toBe(true);
  });

  it("heavily penalizes CrashLoopBackOff pods", () => {
    const { score } = computeDeploymentHealth({
      desiredReplicas: 3,
      availableReplicas: 3,
      totalRestarts: 10,
      crashingPods: 2,
      imagePullErrors: 0,
      pendingPods: 0,
    });
    expect(score).toBeLessThan(70);
  });

  it("never goes below 0", () => {
    const { score } = computeDeploymentHealth({
      desiredReplicas: 5,
      availableReplicas: 0,
      totalRestarts: 100,
      crashingPods: 5,
      imagePullErrors: 5,
      pendingPods: 5,
    });
    expect(score).toBe(0);
  });
});
