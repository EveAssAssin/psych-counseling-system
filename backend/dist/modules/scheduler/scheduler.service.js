"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const sync_service_1 = require("../sync/sync.service");
const conversations_service_1 = require("../conversations/conversations.service");
const analysis_service_1 = require("../analysis/analysis.service");
let SchedulerService = SchedulerService_1 = class SchedulerService {
    constructor(configService, syncService, conversationsService, analysisService) {
        this.configService = configService;
        this.syncService = syncService;
        this.conversationsService = conversationsService;
        this.analysisService = analysisService;
        this.logger = new common_1.Logger(SchedulerService_1.name);
        this.isEnabled = this.configService.get('scheduler.enabled') ?? true;
    }
    onModuleInit() {
        if (this.isEnabled) {
            this.logger.log('Scheduler is enabled');
        }
        else {
            this.logger.warn('Scheduler is disabled');
        }
    }
    async monthlyEmployeeSync() {
        if (!this.isEnabled)
            return;
        this.logger.log('Starting monthly employee sync');
        try {
            const result = await this.syncService.syncEmployees();
            this.logger.log(`Monthly employee sync completed: ${JSON.stringify(result)}`);
        }
        catch (error) {
            this.logger.error('Monthly employee sync failed:', error);
        }
    }
    async dailyEmployeeSync() {
        if (!this.isEnabled)
            return;
        this.logger.log('Starting daily employee sync from Lefthand API');
        try {
            const result = await this.syncService.syncEmployees();
            this.logger.log(`Daily employee sync completed: ${result.total_created} created, ${result.total_updated} updated`);
        }
        catch (error) {
            this.logger.error('Daily employee sync failed:', error);
        }
    }
    async dailyOfficialChannelSync() {
        if (!this.isEnabled)
            return;
        this.logger.log('Starting daily official channel sync');
        try {
            const result = await this.syncService.syncOfficialChannelMessages();
            this.logger.log(`Daily official channel sync completed: ${result.total_created} created, ${result.total_updated} updated`);
        }
        catch (error) {
            this.logger.error('Daily official channel sync failed:', error);
        }
    }
    async dailyDataSync() {
        if (!this.isEnabled)
            return;
        this.logger.log('Starting daily data sync');
        try {
            const result = await this.syncService.syncDailyData();
            this.logger.log(`Daily data sync completed: ${JSON.stringify(result)}`);
        }
        catch (error) {
            this.logger.error('Daily data sync failed:', error);
        }
    }
    async processExtractionQueue() {
        if (!this.isEnabled)
            return;
        this.logger.debug('Checking extraction queue');
        try {
            const pendingIntakes = await this.conversationsService.getPendingForExtraction(10);
            if (pendingIntakes.length === 0) {
                return;
            }
            this.logger.log(`Found ${pendingIntakes.length} intakes pending extraction`);
        }
        catch (error) {
            this.logger.error('Extraction queue processing failed:', error);
        }
    }
    async processAnalysisQueue() {
        if (!this.isEnabled)
            return;
        this.logger.debug('Checking analysis queue');
        try {
            const pendingIntakes = await this.conversationsService.getPendingForAnalysis(5);
            if (pendingIntakes.length === 0) {
                return;
            }
            this.logger.log(`Found ${pendingIntakes.length} intakes pending analysis`);
            for (const intake of pendingIntakes) {
                try {
                    await this.analysisService.analyze(intake.id);
                    this.logger.log(`Analysis completed for intake: ${intake.id}`);
                }
                catch (error) {
                    this.logger.error(`Analysis failed for intake ${intake.id}:`, error);
                }
            }
        }
        catch (error) {
            this.logger.error('Analysis queue processing failed:', error);
        }
    }
    async updateStatusSnapshots() {
        if (!this.isEnabled)
            return;
        this.logger.log('Starting status snapshot update');
    }
    async sendHighRiskAlerts() {
        if (!this.isEnabled)
            return;
        this.logger.log('Checking for high risk alerts');
    }
    async triggerEmployeeSync() {
        this.logger.log('Manual employee sync triggered');
        return this.syncService.syncEmployees('manual');
    }
    async triggerDailySync() {
        this.logger.log('Manual daily sync triggered');
        return this.syncService.syncDailyData('manual');
    }
    async triggerOfficialChannelSync() {
        this.logger.log('Manual official channel sync triggered');
        return this.syncService.syncOfficialChannelMessages('manual');
    }
};
exports.SchedulerService = SchedulerService;
__decorate([
    (0, schedule_1.Cron)('0 4 5 * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "monthlyEmployeeSync", null);
__decorate([
    (0, schedule_1.Cron)('0 5 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "dailyEmployeeSync", null);
__decorate([
    (0, schedule_1.Cron)('30 5 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "dailyOfficialChannelSync", null);
__decorate([
    (0, schedule_1.Cron)('0 6 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "dailyDataSync", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "processExtractionQueue", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_30_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "processAnalysisQueue", null);
__decorate([
    (0, schedule_1.Cron)('0 6 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "updateStatusSnapshots", null);
__decorate([
    (0, schedule_1.Cron)('0 7 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "sendHighRiskAlerts", null);
exports.SchedulerService = SchedulerService = SchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        sync_service_1.SyncService,
        conversations_service_1.ConversationsService,
        analysis_service_1.AnalysisService])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map