import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncService } from '../sync/sync.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AnalysisService } from '../analysis/analysis.service';
export declare class SchedulerService implements OnModuleInit {
    private readonly configService;
    private readonly syncService;
    private readonly conversationsService;
    private readonly analysisService;
    private readonly logger;
    private isEnabled;
    constructor(configService: ConfigService, syncService: SyncService, conversationsService: ConversationsService, analysisService: AnalysisService);
    onModuleInit(): void;
    monthlyEmployeeSync(): Promise<void>;
    dailyEmployeeSync(): Promise<void>;
    dailyOfficialChannelSync(): Promise<void>;
    dailyDataSync(): Promise<void>;
    processExtractionQueue(): Promise<void>;
    processAnalysisQueue(): Promise<void>;
    updateStatusSnapshots(): Promise<void>;
    sendHighRiskAlerts(): Promise<void>;
    triggerEmployeeSync(): Promise<any>;
    triggerDailySync(): Promise<any>;
    triggerOfficialChannelSync(): Promise<any>;
}
