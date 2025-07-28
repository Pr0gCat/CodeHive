import { prisma } from '@/lib/db';
import { config } from '@/lib/config';

export class RateLimiter {
  private readonly dailyTokenLimit: number;
  private readonly minuteRequestLimit: number;

  constructor() {
    this.dailyTokenLimit = parseInt(config.claudeDailyTokenLimit || '10000000');
    this.minuteRequestLimit = parseInt(config.claudeRateLimitPerMinute || '50');
  }

  async canProceed(): Promise<boolean> {
    const [tokensCheck, requestsCheck] = await Promise.all([
      this.checkDailyTokens(),
      this.checkMinuteRequests(),
    ]);

    return tokensCheck && requestsCheck;
  }

  async recordUsage(tokens: number): Promise<void> {
    const now = new Date();
    
    // Record token usage
    await prisma.usageTracking.create({
      data: {
        tokenCount: tokens,
        requestCount: 1,
        resetPeriod: 'day',
      },
    });

    // Update daily limit
    await this.updateUsageLimit('tokens_per_day', tokens);
    
    // Update minute limit  
    await this.updateUsageLimit('requests_per_minute', 1);
  }

  async getStatus() {
    const [dailyUsage, minuteUsage] = await Promise.all([
      this.getDailyTokenUsage(),
      this.getMinuteRequestUsage(),
    ]);

    return {
      dailyTokens: {
        used: dailyUsage,
        limit: this.dailyTokenLimit,
        percentage: Math.round((dailyUsage / this.dailyTokenLimit) * 100),
        remaining: Math.max(0, this.dailyTokenLimit - dailyUsage),
      },
      minuteRequests: {
        used: minuteUsage,
        limit: this.minuteRequestLimit,
        percentage: Math.round((minuteUsage / this.minuteRequestLimit) * 100),
        remaining: Math.max(0, this.minuteRequestLimit - minuteUsage),
      },
    };
  }

  async resetIfNeeded(): Promise<void> {
    const now = new Date();
    
    // Reset daily limits at midnight
    const dailyLimit = await prisma.usageLimit.findUnique({
      where: { limitType: 'tokens_per_day' },
    });

    if (dailyLimit && this.isNewDay(dailyLimit.resetAt, now)) {
      await prisma.usageLimit.update({
        where: { limitType: 'tokens_per_day' },
        data: {
          currentUsage: 0,
          resetAt: this.getEndOfDay(now),
        },
      });
    }

    // Reset minute limits every minute
    const minuteLimit = await prisma.usageLimit.findUnique({
      where: { limitType: 'requests_per_minute' },
    });

    if (minuteLimit && this.isNewMinute(minuteLimit.resetAt, now)) {
      await prisma.usageLimit.update({
        where: { limitType: 'requests_per_minute' },
        data: {
          currentUsage: 0,
          resetAt: this.getEndOfMinute(now),
        },
      });
    }
  }

  private async checkDailyTokens(): Promise<boolean> {
    const usage = await this.getDailyTokenUsage();
    const usagePercentage = (usage / this.dailyTokenLimit) * 100;
    
    // Pause at 90% to leave buffer
    return usagePercentage < 90;
  }

  private async checkMinuteRequests(): Promise<boolean> {
    const usage = await this.getMinuteRequestUsage();
    return usage < this.minuteRequestLimit;
  }

  private async getDailyTokenUsage(): Promise<number> {
    await this.resetIfNeeded();
    
    const limit = await prisma.usageLimit.findUnique({
      where: { limitType: 'tokens_per_day' },
    });

    return limit?.currentUsage || 0;
  }

  private async getMinuteRequestUsage(): Promise<number> {
    await this.resetIfNeeded();
    
    const limit = await prisma.usageLimit.findUnique({
      where: { limitType: 'requests_per_minute' },
    });

    return limit?.currentUsage || 0;
  }

  private async updateUsageLimit(limitType: string, increment: number): Promise<void> {
    const resetAt = limitType === 'tokens_per_day' 
      ? this.getEndOfDay(new Date())
      : this.getEndOfMinute(new Date());

    await prisma.usageLimit.upsert({
      where: { limitType },
      update: {
        currentUsage: { increment },
      },
      create: {
        limitType,
        limitValue: limitType === 'tokens_per_day' ? this.dailyTokenLimit : this.minuteRequestLimit,
        currentUsage: increment,
        resetAt,
      },
    });
  }

  private isNewDay(lastReset: Date, now: Date): boolean {
    return now.getDate() !== lastReset.getDate() ||
           now.getMonth() !== lastReset.getMonth() ||
           now.getFullYear() !== lastReset.getFullYear();
  }

  private isNewMinute(lastReset: Date, now: Date): boolean {
    return Math.floor(now.getTime() / 60000) > Math.floor(lastReset.getTime() / 60000);
  }

  private getEndOfDay(date: Date): Date {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private getEndOfMinute(date: Date): Date {
    const end = new Date(date);
    end.setSeconds(59, 999);
    return end;
  }

  // Manual controls
  async pauseForLimits(): Promise<{ paused: boolean; reason: string }> {
    const status = await this.getStatus();
    
    if (status.dailyTokens.percentage >= 90) {
      return {
        paused: true,
        reason: `Daily token limit reached (${status.dailyTokens.percentage}%)`,
      };
    }

    if (status.minuteRequests.percentage >= 100) {
      return {
        paused: true,
        reason: `Minute request limit reached (${status.minuteRequests.used}/${status.minuteRequests.limit})`,
      };
    }

    return { paused: false, reason: '' };
  }

  async getTimeUntilReset(): Promise<{ daily: number; minute: number }> {
    const now = new Date();
    const endOfDay = this.getEndOfDay(now);
    const endOfMinute = this.getEndOfMinute(now);

    return {
      daily: endOfDay.getTime() - now.getTime(),
      minute: endOfMinute.getTime() - now.getTime(),
    };
  }
}