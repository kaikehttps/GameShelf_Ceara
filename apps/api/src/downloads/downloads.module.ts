import { Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { DownloadMonitorService } from './download-monitor.service.js';
import { DownloadSourcesController } from './download-sources.controller.js';
import { DownloadsController } from './downloads.controller.js';
import { DownloadsService } from './downloads.service.js';
import { LiveState } from './live/live-state.js';
import { MemoryLiveState } from './live/memory-live-state.js';
import { RedisLiveState } from './live/redis-live-state.js';
import { QbittorrentClient } from './qbittorrent/qbittorrent.client.js';

@Module({
  controllers: [DownloadsController, DownloadSourcesController],
  providers: [
    QbittorrentClient,
    DownloadsService,
    DownloadMonitorService,
    {
      // Com REDIS_URL, estado compartilhado entre instâncias; sem, memória do processo.
      provide: LiveState,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): LiveState => {
        const url = config.get('REDIS_URL', { infer: true });
        return url ? new RedisLiveState(url) : new MemoryLiveState();
      },
    },
  ],
})
export class DownloadsModule implements OnApplicationShutdown {
  constructor(@Inject(LiveState) private readonly live: LiveState) {}

  async onApplicationShutdown(): Promise<void> {
    await this.live.close();
  }
}
