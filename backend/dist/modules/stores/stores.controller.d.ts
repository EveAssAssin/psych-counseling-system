import { StoresService } from './stores.service';
export declare class StoresController {
    private readonly storesService;
    constructor(storesService: StoresService);
    findAll(): Promise<import("./stores.service").Store[]>;
    findOne(id: string): Promise<import("./stores.service").Store | null>;
}
