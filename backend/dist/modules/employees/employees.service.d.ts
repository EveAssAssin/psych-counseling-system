import { SupabaseService } from '../supabase/supabase.service';
import { Employee, CreateEmployeeDto, UpdateEmployeeDto, SearchEmployeeDto } from './employees.dto';
export declare class EmployeesService {
    private readonly supabase;
    private readonly logger;
    private readonly TABLE;
    constructor(supabase: SupabaseService);
    create(dto: CreateEmployeeDto): Promise<Employee>;
    findById(id: string): Promise<Employee>;
    findByAppNumber(employeeappnumber: string): Promise<Employee | null>;
    findByErpId(employeeerpid: string): Promise<Employee | null>;
    search(dto: SearchEmployeeDto): Promise<{
        data: Employee[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findAll(options?: {
        is_active?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<Employee[]>;
    update(id: string, dto: UpdateEmployeeDto): Promise<Employee>;
    upsert(dto: CreateEmployeeDto, sourcePayload?: Record<string, any>): Promise<Employee>;
    bulkUpsert(employees: (CreateEmployeeDto & {
        source_payload?: Record<string, any>;
    })[]): Promise<{
        created: number;
        updated: number;
        failed: number;
        errors: {
            employeeappnumber: string;
            error: string;
        }[];
    }>;
    softDelete(id: string): Promise<Employee>;
    getStats(): Promise<{
        total: number;
        active: number;
        inactive: number;
        onLeave: number;
    }>;
    identify(identifiers: {
        employeeappnumber?: string;
        employeeerpid?: string;
        name?: string;
        store_name?: string;
    }): Promise<Employee | null>;
}
