import { DatabaseManager } from '../packages/database/dist/index.js';
import { resolveAppPaths, ensureAppDirectories } from '../packages/config/dist/index.js';

const p = resolveAppPaths();
ensureAppDirectories(p);
const m = new DatabaseManager({ filePath: p.databasePath });
await m.initialize();
await m.runMigrations();
const ds = m.getDataSource();
console.log(p.databasePath);
console.log(JSON.stringify(await ds.query('SELECT * FROM app_identity')));
console.log((await ds.query('SELECT name FROM migrations ORDER BY id')).map((r) => r.name).join(', '));
console.log('tables:', (await ds.query("SELECT count(*) AS c FROM sqlite_master WHERE type='table'"))[0].c);
await m.close();
