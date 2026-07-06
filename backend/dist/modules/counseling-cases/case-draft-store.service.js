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
var CaseDraftStoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseDraftStoreService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let CaseDraftStoreService = CaseDraftStoreService_1 = class CaseDraftStoreService {
    constructor() {
        this.logger = new common_1.Logger(CaseDraftStoreService_1.name);
        this.store = new Map();
        this.TTL_MS = 24 * 60 * 60 * 1000;
        this.PRUNE_INTERVAL_MS = 30 * 60 * 1000;
        setInterval(() => this.prune(), this.PRUNE_INTERVAL_MS).unref();
    }
    put(payload) {
        const token = (0, crypto_1.randomUUID)();
        this.store.set(token, {
            payload,
            expires_at: Date.now() + this.TTL_MS,
        });
        this.logger.log(`Draft stored: ${token.slice(0, 8)}… (total ${this.store.size})`);
        return token;
    }
    get(token) {
        const entry = this.store.get(token);
        if (!entry)
            return null;
        if (Date.now() > entry.expires_at) {
            this.store.delete(token);
            return null;
        }
        return entry.payload;
    }
    delete(token) {
        return this.store.delete(token);
    }
    prune() {
        const now = Date.now();
        let removed = 0;
        for (const [k, v] of this.store) {
            if (now > v.expires_at) {
                this.store.delete(k);
                removed++;
            }
        }
        if (removed > 0) {
            this.logger.log(`Pruned ${removed} expired drafts (${this.store.size} remain)`);
        }
        return removed;
    }
    size() {
        return this.store.size;
    }
};
exports.CaseDraftStoreService = CaseDraftStoreService;
exports.CaseDraftStoreService = CaseDraftStoreService = CaseDraftStoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], CaseDraftStoreService);
//# sourceMappingURL=case-draft-store.service.js.map