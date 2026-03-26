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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const query_service_1 = require("./query.service");
let QueryController = class QueryController {
    constructor(queryService) {
        this.queryService = queryService;
    }
    async query(request) {
        return this.queryService.query(request);
    }
    async getEmployeeStatus(employeeappnumber, employeeerpid, name) {
        return this.queryService.getEmployeeStatusSummary({
            employeeappnumber,
            employeeerpid,
            name,
        });
    }
    async chat(body) {
        return this.queryService.query({
            question: body.message,
            requester_id: body.user_id,
        });
    }
};
exports.QueryController = QueryController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '問答查詢（心橋/OpenClaw 整合用）' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                question: { type: 'string', description: '問題' },
                employee_identifier: {
                    type: 'object',
                    properties: {
                        employeeappnumber: { type: 'string' },
                        employeeerpid: { type: 'string' },
                        name: { type: 'string' },
                    },
                },
                context: { type: 'string', description: '額外背景資訊' },
                requester_id: { type: 'string', description: '查詢者 ID' },
            },
            required: ['question'],
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '查詢結果' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QueryController.prototype, "query", null);
__decorate([
    (0, common_1.Get)('employee-status'),
    (0, swagger_1.ApiOperation)({ summary: '取得員工狀態摘要' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '員工狀態' }),
    __param(0, (0, common_1.Query)('employeeappnumber')),
    __param(1, (0, common_1.Query)('employeeerpid')),
    __param(2, (0, common_1.Query)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], QueryController.prototype, "getEmployeeStatus", null);
__decorate([
    (0, common_1.Post)('chat'),
    (0, swagger_1.ApiOperation)({ summary: '對話式查詢' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', description: '使用者訊息' },
                session_id: { type: 'string', description: '對話 Session ID' },
                user_id: { type: 'string', description: '使用者 ID' },
            },
            required: ['message'],
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '回覆' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QueryController.prototype, "chat", null);
exports.QueryController = QueryController = __decorate([
    (0, swagger_1.ApiTags)('query'),
    (0, common_1.Controller)('query'),
    __metadata("design:paramtypes", [query_service_1.QueryService])
], QueryController);
//# sourceMappingURL=query.controller.js.map