export interface Database {
    run: (sql: string, params?: any[]) => Promise<{
        lastID: number;
        changes: number;
    }>;
    get: <T = any>(sql: string, params?: any[]) => Promise<T | undefined>;
    all: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
    close: () => Promise<void>;
}
export declare function initDatabase(): Promise<Database>;
export declare function getDb(): Database;
//# sourceMappingURL=db.d.ts.map