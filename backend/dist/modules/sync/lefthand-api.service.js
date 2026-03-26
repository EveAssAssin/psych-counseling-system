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
var LefthandApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LefthandApiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const crypto = require("crypto");
let LefthandApiService = LefthandApiService_1 = class LefthandApiService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(LefthandApiService_1.name);
        this.MAP_API_URL = 'https://map.lohasglasses.com/_api/v1.ashx';
        this.AES_KEY = 'GmAOoS003d5OJ2G2';
        this.AES_IV = 'bgfDcfWdWG6NSUr5';
    }
    encrypt(text) {
        const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(this.AES_KEY, 'utf8'), Buffer.from(this.AES_IV, 'utf8'));
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    }
    decrypt(encryptedText) {
        const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(this.AES_KEY, 'utf8'), Buffer.from(this.AES_IV, 'utf8'));
        let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    async getAllEmployees() {
        try {
            this.logger.log('Fetching all employees from Lefthand API...');
            const response = await axios_1.default.post(this.MAP_API_URL, {
                method: 'getallemployees',
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            });
            const result = response.data;
            if (result.statecode === '0') {
                const employees = Array.isArray(result.data) ? result.data : [];
                this.logger.log(`Successfully fetched ${employees.length} employees`);
                return {
                    success: true,
                    data: employees,
                    message: result.message || '取得成功',
                };
            }
            else {
                this.logger.error(`API error: ${result.message}`);
                return {
                    success: false,
                    data: [],
                    message: result.message || 'API 錯誤',
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to fetch employees:', error.message);
            return {
                success: false,
                data: [],
                message: error.message,
            };
        }
    }
    async getAllStoresWithEmployees() {
        try {
            this.logger.log('Fetching all stores with employees from Lefthand API...');
            const response = await axios_1.default.post(this.MAP_API_URL, {
                method: 'getstoredatas',
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            });
            const result = response.data;
            if (result.statecode === '0') {
                const stores = Array.isArray(result.data) ? result.data : [];
                this.logger.log(`Successfully fetched ${stores.length} stores`);
                return {
                    success: true,
                    data: stores,
                    message: result.message || '取得成功',
                };
            }
            else {
                this.logger.error(`API error: ${result.message}`);
                return {
                    success: false,
                    data: [],
                    message: result.message || 'API 錯誤',
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to fetch stores:', error.message);
            return {
                success: false,
                data: [],
                message: error.message,
            };
        }
    }
    async getEmployeesByGroup(groupErpId) {
        try {
            const encryptedGroupId = this.encrypt(groupErpId);
            const response = await axios_1.default.post(this.MAP_API_URL, {
                method: 'getemployeebygroup',
                groupid: encryptedGroupId,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            const result = response.data;
            if (result.statecode === '0') {
                const employees = Array.isArray(result.data) ? result.data : [];
                return {
                    success: true,
                    data: employees,
                    message: result.message || '取得成功',
                };
            }
            else {
                return {
                    success: false,
                    data: [],
                    message: result.message || 'API 錯誤',
                };
            }
        }
        catch (error) {
            this.logger.error(`Failed to fetch employees for group ${groupErpId}:`, error.message);
            return {
                success: false,
                data: [],
                message: error.message,
            };
        }
    }
    async getEmployeesByErpIds(erpIds) {
        try {
            const idsString = erpIds.join(',');
            const encryptedIds = this.encrypt(idsString);
            const response = await axios_1.default.post(this.MAP_API_URL, {
                method: 'getemployeebyerps',
                id: encryptedIds,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            const result = response.data;
            if (result.statecode === '0') {
                const employees = Array.isArray(result.data) ? result.data : [];
                return {
                    success: true,
                    data: employees,
                    message: result.message || '取得成功',
                };
            }
            else {
                return {
                    success: false,
                    data: [],
                    message: result.message || 'API 錯誤',
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to fetch employees by ERP IDs:', error.message);
            return {
                success: false,
                data: [],
                message: error.message,
            };
        }
    }
    async getAllAreas() {
        try {
            const response = await axios_1.default.post(this.MAP_API_URL, {
                method: 'getareas',
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            const result = response.data;
            if (result.statecode === '0') {
                return {
                    success: true,
                    data: result.data || [],
                    message: result.message || '取得成功',
                };
            }
            else {
                return {
                    success: false,
                    data: [],
                    message: result.message || 'API 錯誤',
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to fetch areas:', error.message);
            return {
                success: false,
                data: [],
                message: error.message,
            };
        }
    }
};
exports.LefthandApiService = LefthandApiService;
exports.LefthandApiService = LefthandApiService = LefthandApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], LefthandApiService);
//# sourceMappingURL=lefthand-api.service.js.map