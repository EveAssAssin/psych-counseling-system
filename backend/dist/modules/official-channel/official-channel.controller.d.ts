import { OfficialChannelService } from './official-channel.service';
export declare class OfficialChannelController {
    private readonly officialChannelService;
    constructor(officialChannelService: OfficialChannelService);
    search(employeeId?: string, employeeAppNumber?: string, channel?: string, limit?: number, offset?: number): Promise<{
        data: import("./official-channel.service").OfficialChannelMessage[];
        total: number;
    }>;
    getStats(): Promise<{
        total: number;
        by_channel: Record<string, number>;
        recent_count: number;
    }>;
    getByEmployeeId(employeeId: string, limit?: number): Promise<import("./official-channel.service").OfficialChannelMessage[]>;
    getByAppNumber(appNumber: string, limit?: number): Promise<import("./official-channel.service").OfficialChannelMessage[]>;
    getById(id: string): Promise<import("./official-channel.service").OfficialChannelMessage | null>;
}
