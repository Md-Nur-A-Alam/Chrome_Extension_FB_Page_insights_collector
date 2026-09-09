import { ContentItem, PerformanceDirection } from '../shared/types';

export interface PerformanceResult {
  performancePercent: number | null;
  performanceDirection: PerformanceDirection;
  performanceLabel: string;
}

export class PerformanceEngine {
  /**
   * Computes comparative performance against a historical baseline pool
   */
  static calculatePerformance(
    item: ContentItem,
    baselinePool: ContentItem[]
  ): PerformanceResult {
    // 1. Filter baseline items of the SAME type, excluding self
    const validPool = baselinePool.filter(
      (b) => b.type === item.type && b.id !== item.id
    );

    // Cold start protection: Need at least 5 baseline items
    if (validPool.length < 5) {
      return {
        performancePercent: null,
        performanceDirection: 'unknown',
        performanceLabel: 'Insufficient Data'
      };
    }

    if (item.type === 'reel') {
      return this.calculateReelScore(item, validPool);
    } else {
      return this.calculatePostScore(item, validPool);
    }
  }

  private static calculateReelScore(item: ContentItem, pool: ContentItem[]): PerformanceResult {
    // Views average
    const viewsList = pool.map((p) => p.views).filter((v): v is number => v !== null && v > 0);
    const avgViews = viewsList.length > 0 ? viewsList.reduce((a, b) => a + b, 0) / viewsList.length : 0;

    // Engagement average
    const engList = pool.map((p) => p.totalEngagement).filter((e): e is number => e !== null && e > 0);
    const avgEng = engList.length > 0 ? engList.reduce((a, b) => a + b, 0) / engList.length : 0;

    // Engagement rate average
    const rateList = pool.map((p) => p.engagementRate).filter((r): r is number => r !== null && r > 0);
    const avgRate = rateList.length > 0 ? rateList.reduce((a, b) => a + b, 0) / rateList.length : 0;

    let totalWeight = 0;
    let weightedDelta = 0;

    if (item.views !== null && avgViews > 0) {
      const deltaViews = ((item.views - avgViews) / avgViews) * 100;
      weightedDelta += deltaViews * 0.4;
      totalWeight += 0.4;
    }

    if (item.totalEngagement !== null && avgEng > 0) {
      const deltaEng = ((item.totalEngagement - avgEng) / avgEng) * 100;
      weightedDelta += deltaEng * 0.3;
      totalWeight += 0.3;
    }

    if (item.engagementRate !== null && avgRate > 0) {
      const deltaRate = ((item.engagementRate - avgRate) / avgRate) * 100;
      weightedDelta += deltaRate * 0.2;
      totalWeight += 0.2;
    }

    if (totalWeight === 0) {
      return {
        performancePercent: null,
        performanceDirection: 'unknown',
        performanceLabel: 'Insufficient Data'
      };
    }

    const finalPercent = Number((weightedDelta / totalWeight).toFixed(1));
    const direction = this.getDirection(finalPercent);
    const label = this.getLabel(finalPercent);

    return {
      performancePercent: finalPercent,
      performanceDirection: direction,
      performanceLabel: label
    };
  }

  private static calculatePostScore(item: ContentItem, pool: ContentItem[]): PerformanceResult {
    const engList = pool.map((p) => p.totalEngagement).filter((e): e is number => e !== null && e > 0);
    const avgEng = engList.length > 0 ? engList.reduce((a, b) => a + b, 0) / engList.length : 0;

    const velList = pool.map((p) => p.engagementPerHour).filter((v): v is number => v !== null && v > 0);
    const avgVel = velList.length > 0 ? velList.reduce((a, b) => a + b, 0) / velList.length : 0;

    let totalWeight = 0;
    let weightedDelta = 0;

    if (item.totalEngagement !== null && avgEng > 0) {
      const deltaEng = ((item.totalEngagement - avgEng) / avgEng) * 100;
      weightedDelta += deltaEng * 0.6;
      totalWeight += 0.6;
    }

    if (item.engagementPerHour !== null && avgVel > 0) {
      const deltaVel = ((item.engagementPerHour - avgVel) / avgVel) * 100;
      weightedDelta += deltaVel * 0.4;
      totalWeight += 0.4;
    }

    if (totalWeight === 0) {
      return {
        performancePercent: null,
        performanceDirection: 'unknown',
        performanceLabel: 'Insufficient Data'
      };
    }

    const finalPercent = Number((weightedDelta / totalWeight).toFixed(1));
    const direction = this.getDirection(finalPercent);
    const label = this.getLabel(finalPercent);

    return {
      performancePercent: finalPercent,
      performanceDirection: direction,
      performanceLabel: label
    };
  }

  private static getDirection(percent: number): PerformanceDirection {
    if (percent > 10.0) return 'up';
    if (percent < -10.0) return 'down';
    return 'neutral';
  }

  private static getLabel(percent: number): string {
    if (percent >= 50.0) return 'Excellent';
    if (percent >= 15.0) return 'Above Average';
    if (percent > -15.0) return 'Average';
    if (percent >= -50.0) return 'Below Average';
    return 'Poor';
  }
}
