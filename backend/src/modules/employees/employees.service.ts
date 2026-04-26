import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  SearchEmployeeDto,
} from './employees.dto';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);
  private readonly TABLE = 'employees';

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 撱箇??∪極
   */
  async create(dto: CreateEmployeeDto): Promise<Employee> {
    this.logger.log(`Creating employee: ${dto.employeeappnumber}`);

    const employee = await this.supabase.create<Employee>(
      this.TABLE,
      {
        ...dto,
        is_active: dto.is_active ?? true,
        is_leave: dto.is_leave ?? false,
        synced_at: new Date().toISOString(),
      },
      { useAdmin: true },
    );

    this.logger.log(`Employee created: ${employee.id}`);
    return employee;
  }

  /**
   * ???桐??∪極嚗y ID嚗?
   */
  async findById(id: string): Promise<Employee> {
    const employee = await this.supabase.findOne<Employee>(
      this.TABLE,
      { id },
      { useAdmin: true },
    );

    if (!employee) {
      throw new NotFoundException(`Employee not found: ${id}`);
    }

    return employee;
  }

  /**
   * ???桐??∪極嚗y employeeappnumber嚗?
   */
  async findByAppNumber(employeeappnumber: string): Promise<Employee | null> {
    // Use direct query with limit(1) to handle duplicate records gracefully
    const client = this.supabase.getAdminClient();
    const { data, error } = await client
      .from(this.TABLE)
      .select('*')
      .eq('employeeappnumber', employeeappnumber)
      .order('synced_at', { ascending: false })
      .limit(1);

    if (error) {
      this.logger.error(`Error finding employee by app number ${employeeappnumber}:`, error);
      throw error;
    }

    return data && data.length > 0 ? (data[0] as Employee) : null;
  }

  /**
   * ???桐??∪極嚗y employeeerpid嚗?
   */
  async findByErpId(employeeerpid: string): Promise<Employee | null> {
    return this.supabase.findOne<Employee>(
      this.TABLE,
      { employeeerpid },
      { useAdmin: true },
    );
  }

  /**
   * ???∪極
   */
  async search(dto: SearchEmployeeDto): Promise<{
    data: Employee[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = dto.limit || 20;
    const offset = dto.offset || 0;

    const client = this.supabase.getAdminClient();
    
    // 憒???撠??萄?嚗蝙??filter ?孵?
    if (dto.q) {
      // ??敺??泵?隞?隞嗥??∪極嚗???JavaScript ?蕪
      let query = client.from(this.TABLE).select('*');
      
      if (dto.store_id) {
        query = query.eq('store_id', dto.store_id);
      }
      if (dto.department) {
        query = query.eq('department', dto.department);
      }
      if (dto.is_active !== undefined) {
        query = query.eq('is_active', dto.is_active);
      }

      const { data: allData, error } = await query.order('name', { ascending: true });

      if (error) {
        this.logger.error('Error searching employees:', error);
        throw error;
      }

      // JavaScript ?蕪銝剜???
      const searchTerm = dto.q.toLowerCase();
      const filtered = (allData || []).filter((emp: Employee) => {
        return (
          emp.name?.toLowerCase().includes(searchTerm) ||
          emp.employeeappnumber?.toLowerCase().includes(searchTerm) ||
          emp.employeeerpid?.toLowerCase().includes(searchTerm) ||
          emp.store_name?.toLowerCase().includes(searchTerm) ||
          emp.department?.toLowerCase().includes(searchTerm)
        );
      });

      // ??
      const paged = filtered.slice(offset, offset + limit);

      return {
        data: paged,
        total: filtered.length,
        limit,
        offset,
      };
    }

    // 瘝????摮?雿輻??閰Ｘ撘?
    let query = client.from(this.TABLE).select('*', { count: 'exact' });

    if (dto.store_id) {
      query = query.eq('store_id', dto.store_id);
    }
    if (dto.department) {
      query = query.eq('department', dto.department);
    }
    if (dto.is_active !== undefined) {
      query = query.eq('is_active', dto.is_active);
    }

    query = query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      this.logger.error('Error searching employees:', error);
      throw error;
    }

    return {
      data: data || [],
      total: count || 0,
      limit,
      offset,
    };
  }

  /**
   * ????撌?
   */
  async findAll(options?: {
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Employee[]> {
    return this.supabase.findMany<Employee>(this.TABLE, {
      filters: options?.is_active !== undefined ? { is_active: options.is_active } : undefined,
      orderBy: { column: 'name', ascending: true },
      limit: options?.limit,
      offset: options?.offset,
      useAdmin: true,
    });
  }

  /**
   * ?湔?∪極
   */
  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    this.logger.log(`Updating employee: ${id}`);

    const employee = await this.supabase.update<Employee>(
      this.TABLE,
      { id },
      dto,
      { useAdmin: true },
    );

    if (!employee) {
      throw new NotFoundException(`Employee not found: ${id}`);
    }

    return employee;
  }

  /**
   * Upsert ?∪極嚗?甇亦嚗?
   */
  async upsert(dto: CreateEmployeeDto, sourcePayload?: Record<string, any>): Promise<Employee> {
    this.logger.debug(`Upserting employee: ${dto.employeeappnumber}`);

    const data = {
      ...dto,
      source_payload: sourcePayload,
      source_updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    };

    return this.supabase.upsert<Employee>(this.TABLE, data, {
      onConflict: 'employeeappnumber',
      useAdmin: true,
    });
  }

  /**
   * ?寥? Upsert
   */
  async bulkUpsert(
    employees: (CreateEmployeeDto & { source_payload?: Record<string, any> })[],
  ): Promise<{
    created: number;
    updated: number;
    failed: number;
    errors: { employeeappnumber: string; error: string }[];
  }> {
    const result = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as { employeeappnumber: string; error: string }[],
    };

    for (const emp of employees) {
      try {
        const existing = await this.findByAppNumber(emp.employeeappnumber);

        await this.upsert(emp, emp.source_payload);

        if (existing) {
          result.updated++;
        } else {
          result.created++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          employeeappnumber: emp.employeeappnumber,
          error: error.message,
        });
        this.logger.error(`Failed to upsert employee ${emp.employeeappnumber}:`, error);
      }
    }

    this.logger.log(
      `Bulk upsert completed: ${result.created} created, ${result.updated} updated, ${result.failed} failed`,
    );

    return result;
  }

  /**
   * ?芷?∪極嚗??芷嚗?
   */
  async softDelete(id: string): Promise<Employee> {
    return this.update(id, { is_active: false });
  }

  /**
   * ???∪極蝯梯?
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    onLeave: number;
  }> {
    const [total, active, onLeave] = await Promise.all([
      this.supabase.count(this.TABLE, {}, { useAdmin: true }),
      this.supabase.count(this.TABLE, { is_active: true }, { useAdmin: true }),
      this.supabase.count(this.TABLE, { is_leave: true }, { useAdmin: true }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      onLeave,
    };
  }

  /**
   * 撠犖霅嚗??蝔株??亥?閮?啣撌伐?
   */
  async identify(identifiers: {
    employeeappnumber?: string;
    employeeerpid?: string;
    name?: string;
    store_name?: string;
  }): Promise<Employee | null> {
    // ?芸?摨?employeeappnumber > employeeerpid > name + store

    if (identifiers.employeeappnumber) {
      const emp = await this.findByAppNumber(identifiers.employeeappnumber);
      if (emp) return emp;
    }

    if (identifiers.employeeerpid) {
      const emp = await this.findByErpId(identifiers.employeeerpid);
      if (emp) return emp;
    }

    // ?? + ?撣?璅∠?瘥?嚗?靘犖撌亙摰???
    if (identifiers.name) {
      const client = this.supabase.getAdminClient();
      let query = client
        .from(this.TABLE)
        .select('*')
        .eq('name', identifiers.name);

      if (identifiers.store_name) {
        query = query.eq('store_name', identifiers.store_name);
      }

      const { data } = await query.limit(1);

      if (data && data.length > 0) {
        this.logger.warn(
          `Employee identified by name+store (not recommended): ${identifiers.name}`,
        );
        return data[0] as Employee;
      }
    }

    return null;
  }
}

