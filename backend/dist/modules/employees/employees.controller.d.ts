import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto, SearchEmployeeDto } from './employees.dto';
export declare class EmployeesController {
    private readonly employeesService;
    constructor(employeesService: EmployeesService);
    create(dto: CreateEmployeeDto): Promise<import("./employees.dto").Employee>;
    search(dto: SearchEmployeeDto): Promise<{
        data: import("./employees.dto").Employee[];
        total: number;
        limit: number;
        offset: number;
    }>;
    getStats(): Promise<{
        total: number;
        active: number;
        inactive: number;
        onLeave: number;
    }>;
    findOne(id: string): Promise<import("./employees.dto").Employee>;
    findByAppNumber(appnumber: string): Promise<import("./employees.dto").Employee | {
        found: boolean;
        message: string;
    }>;
    update(id: string, dto: UpdateEmployeeDto): Promise<import("./employees.dto").Employee>;
    delete(id: string): Promise<void>;
    identify(body: {
        employeeappnumber?: string;
        employeeerpid?: string;
        name?: string;
        store_name?: string;
    }): Promise<{
        found: boolean;
        message: string;
        employee?: undefined;
    } | {
        found: boolean;
        employee: import("./employees.dto").Employee;
        message?: undefined;
    }>;
    bulkUpsert(body: {
        employees: (CreateEmployeeDto & {
            source_payload?: Record<string, any>;
        })[];
    }): Promise<{
        created: number;
        updated: number;
        failed: number;
        errors: {
            employeeappnumber: string;
            error: string;
        }[];
    }>;
}
