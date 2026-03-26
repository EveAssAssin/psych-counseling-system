import { ConfigService } from '@nestjs/config';
export declare class LefthandApiService {
    private readonly configService;
    private readonly logger;
    private readonly MAP_API_URL;
    private readonly AES_KEY;
    private readonly AES_IV;
    constructor(configService: ConfigService);
    private encrypt;
    private decrypt;
    getAllEmployees(): Promise<{
        success: boolean;
        data: EmployeeApiData[];
        message: string;
    }>;
    getAllStoresWithEmployees(): Promise<{
        success: boolean;
        data: StoreApiData[];
        message: string;
    }>;
    getEmployeesByGroup(groupErpId: string): Promise<{
        success: boolean;
        data: EmployeeDetailApiData[];
        message: string;
    }>;
    getEmployeesByErpIds(erpIds: string[]): Promise<{
        success: boolean;
        data: EmployeeDetailApiData[];
        message: string;
    }>;
    getAllAreas(): Promise<{
        success: boolean;
        data: AreaApiData[];
        message: string;
    }>;
}
export interface EmployeeApiData {
    employeeappnumber: string;
    employeename: string;
    employeeimage?: string;
    employeeerpid?: string;
}
export interface EmployeeDetailApiData {
    id: string;
    groupid: string;
    grouperpid: string;
    groupname: string;
    erpid: string;
    name: string;
    role: string;
    jobtitle: string;
    introduction?: string;
    timelimitedmessage?: string;
    photos?: string[];
    isfreeze: boolean;
    isleave: boolean;
    leavetime?: string;
    firsthonor?: string;
    honors?: {
        title: string;
    }[];
    averagescore?: string;
}
export interface StoreApiData {
    city: string;
    id: string;
    erpid: string;
    name: string;
    subname?: string;
    description?: string;
    address?: string;
    phone?: string;
    worktime?: string;
    longitude?: string;
    latitude?: string;
    coverimage?: string;
    photos?: string[];
    sort?: string;
    employees?: StoreEmployeeApiData[];
}
export interface StoreEmployeeApiData {
    id: string;
    groupid: string;
    erpid: string;
    token?: string;
    account?: string;
    password?: string;
    name: string;
    role?: string;
    jobtitle?: string;
    introduction?: string;
    photos?: string;
    honor?: string;
    isleave?: boolean;
    isfreeze?: boolean;
}
export interface AreaApiData {
    id: number;
    name: string;
}
