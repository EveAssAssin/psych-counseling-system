import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncService } from '../sync/sync.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AnalysisService } from '../analysis/analysis.service';
import { EmployeeSyncService } from '../employee-sync/employee-sync.service';
export declare class SchedulerService implements OnModuleInit {
    private readonly configService;
    private readonly syncService;
    private readonly conversationsService;
    private readonly analysisService;
    private readonly employeeSyncService;
    private readonly logger;
    private isEnabled;
    constructor(configService: ConfigService, syncService: SyncService, conversationsService: ConversationsService, analysisService: AnalysisService, employeeSyncService: EmployeeSyncService);
    onModuleInit(): void;
    monthlyEmployeeSync(): Promise<void>;
    dailyEmployeeSync(): Promise<void>;
    dailyOfficialChannelSync(): Promise<void>;
    dailyDataSync(): Promise<void>;
    processExtractionQueue(): Promise<void>;
    processAnalysisQueue(): Promise<void>;
    updateStatusSnapshots(): Promise<void>;
    monthlyEmployeeCacheSync(): Promise<void>;
    sendHighRiskAlerts(): Promise<void>;
    triggerEmployeeSync(): Promise<any>;
    triggerDailySync(): Promise<any>;
    triggerOfficialChannelSync(): Promise<any>;
}
