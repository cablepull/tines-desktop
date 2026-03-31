const duckdb = require('duckdb');
const path = require('path');

let db;

function ensureColumn(tableName, columnName, columnType) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info('${tableName}')`, (err, cols) => {
      if (err) {
        return reject(err);
      }

      if (cols && cols.find((col) => col.name === columnName)) {
        return resolve();
      }

      db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`, (alterErr) => {
        if (alterErr) {
          return reject(alterErr);
        }
        resolve();
      });
    });
  });
}

/**
 * Initialize the DuckDB database in the user data directory.
 * @param {string} userDataPath 
 */
/**
 * Initialize the DuckDB database in the user data directory.
 * @param {string} userDataPath 
 */
function init(userDataPath) {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(userDataPath, 'tines_debugger.db');
    db = new duckdb.Database(dbPath);

    // Initialize Schema and ensure columns exist
    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR PRIMARY KEY,
        action_id INTEGER,
        story_id INTEGER,
        run_guid VARCHAR,
        status VARCHAR,
        created_at TIMESTAMP,
        payload_json TEXT
      );
    `, (err) => {
      if (err) {
        console.error('DuckDB Init: Failed to create events table', err);
        return reject(err);
      }

      ensureColumn('events', 'run_guid', 'VARCHAR')
        .then(() => db.run(`
          CREATE TABLE IF NOT EXISTS logs (
            id VARCHAR PRIMARY KEY,
            action_id INTEGER,
            story_id INTEGER,
            run_guid VARCHAR,
            level VARCHAR,
            message TEXT,
            created_at TIMESTAMP,
            payload_json TEXT
          );
        `, (logsErr) => {
          if (logsErr) {
            console.error('DuckDB Init: Failed to create logs table', logsErr);
            return reject(logsErr);
          }

          Promise.all([
            ensureColumn('logs', 'run_guid', 'VARCHAR'),
            ensureColumn('logs', 'payload_json', 'TEXT'),
          ])
            .then(() => db.run(`
              CREATE TABLE IF NOT EXISTS investigations (
                id VARCHAR PRIMARY KEY,
                name VARCHAR,
                tenant VARCHAR,
                story_id INTEGER,
                mode VARCHAR,
                draft_id INTEGER,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                payload_json TEXT
              );
            `, (investigationsErr) => {
              if (investigationsErr) {
                console.error('DuckDB Init: Failed to create investigations table', investigationsErr);
                return reject(investigationsErr);
              }

              Promise.all([
                ensureColumn('investigations', 'tenant', 'VARCHAR'),
                ensureColumn('investigations', 'story_id', 'INTEGER'),
                ensureColumn('investigations', 'mode', 'VARCHAR'),
                ensureColumn('investigations', 'draft_id', 'INTEGER'),
                ensureColumn('investigations', 'created_at', 'TIMESTAMP'),
                ensureColumn('investigations', 'updated_at', 'TIMESTAMP'),
                ensureColumn('investigations', 'payload_json', 'TEXT'),
              ])
                .then(() => {
                  console.log('DuckDB initialized at:', dbPath);
                  resolve();
                })
                .catch((migrationErr) => {
                  console.error('DuckDB Init: Failed to migrate investigations table', migrationErr);
                  reject(migrationErr);
                });
            }))
            .catch((migrationErr) => {
              console.error('DuckDB Init: Failed to migrate logs table', migrationErr);
              reject(migrationErr);
            });
        }))
        .catch((migrationErr) => {
          console.error('DuckDB Init: Failed to migrate events table', migrationErr);
          reject(migrationErr);
        });
    });
  });
}

/**
 * Promisified wrapper for database queries using direct db.all with call/spread
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const values = params.map(p => (p === undefined || p === null) ? null : p);
    const cb = (err, res) => {
      if (err) {
        console.error(`DuckDB Query Error [${sql}]:`, err);
        reject(err);
      } else resolve(res);
    };
    
    // Explicitly call to preserve 'this' context for spread arguments on native proxies
    try {
      db.all.call(db, sql, ...values, cb);
    } catch (e) {
      console.error('DuckDB: Fatal query invocation error', e);
      reject(e);
    }
  });
}

/**
 * Promisified wrapper for database runs using direct db.run with call/spread
 */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const values = params.map(p => (p === undefined || p === null) ? null : p);
    const cb = (err) => {
      if (err) {
        console.error(`DuckDB Run Error [${sql}]:`, err);
        reject(err);
      } else resolve();
    };

    // Explicitly call to preserve 'this' context for spread arguments on native proxies
    try {
      db.run.call(db, sql, ...values, cb);
    } catch (e) {
      console.error('DuckDB: Fatal run invocation error', e);
      reject(e);
    }
  });
}

async function clearDatabase() {
  try {
    await run('DELETE FROM events');
    await run('DELETE FROM logs');
    await run('DELETE FROM investigations');
    console.log('DuckDB: Database cleared successfully');
  } catch (e) {
    console.error('DuckDB: Failed to clear database', e);
  }
}

async function saveEvents(events) {
  for (const event of events) {
    try {
      // Use standard INSERT INTO ... ON CONFLICT pattern for DuckDB
      await run(`
        INSERT INTO events (id, action_id, story_id, run_guid, status, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          run_guid = EXCLUDED.run_guid,
          payload_json = EXCLUDED.payload_json
      `, [
        String(event.id),
        event.action_id,
        event.story_id,
        event.story_run_guid || event.run_guid || event.execution_run_guid || null,
        event.status,
        event.created_at,
        JSON.stringify(event)
      ]);
    } catch (e) {
      console.error(`DuckDB: Failed to save event ${event.id}`, e);
    }
  }
}

async function saveLogs(logs) {
  for (const log of logs) {
    try {
      const derivedRunGuid =
        log.story_run_guid ||
        log.run_guid ||
        log.execution_run_guid ||
        log.inbound_event?.story_run_guid ||
        log.inbound_event?.run_guid ||
        log.inbound_event?.execution_run_guid ||
        null;

      await run(`
        INSERT INTO logs (id, action_id, story_id, run_guid, level, message, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          run_guid = EXCLUDED.run_guid,
          level = EXCLUDED.level,
          message = EXCLUDED.message,
          created_at = EXCLUDED.created_at,
          payload_json = EXCLUDED.payload_json
      `, [
        String(log.id),
        log.action_id,
        log.story_id,
        derivedRunGuid,
        log.level,
        log.message,
        log.created_at,
        JSON.stringify(log)
      ]);
    } catch (e) {
      console.error(`DuckDB: Failed to save log ${log.id}`, e);
    }
  }
}

async function getEvents(storyId, actionId = null, limit = 100, offset = 0, runGuid = null, sinceIso = null) {
  let sql = 'SELECT * FROM events WHERE story_id = ?';
  let params = [storyId];
  if (actionId) {
    sql += ' AND action_id = ?';
    params.push(actionId);
  }
  if (runGuid) {
    sql += ' AND run_guid = ?';
    params.push(runGuid);
  }
  if (sinceIso) {
    sql += ' AND created_at >= ?';
    params.push(sinceIso);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const rows = await query(sql, params);
  return rows.map(r => ({
    ...JSON.parse(r.payload_json),
    id: r.id,
    action_id: r.action_id,
    story_id: r.story_id,
    run_guid: r.run_guid,
    story_run_guid: r.run_guid,
    status: r.status,
    created_at: r.created_at
  }));
}

async function getLogs(storyId, actionId = null, limit = 200, offset = 0, runGuid = null, sinceIso = null) {
  let sql = 'SELECT * FROM logs WHERE story_id = ?';
  let params = [storyId];
  if (actionId) {
    sql += ' AND action_id = ?';
    params.push(actionId);
  }
  if (runGuid) {
    sql += ' AND run_guid = ?';
    params.push(runGuid);
  }
  if (sinceIso) {
    sql += ' AND created_at >= ?';
    params.push(sinceIso);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await query(sql, params);
  return rows.map((row) => {
    let payload = {};
    if (row.payload_json) {
      try {
        payload = JSON.parse(row.payload_json);
      } catch (e) {
        console.error(`DuckDB: Failed to parse cached log payload ${row.id}`, e);
      }
    }

    return {
      ...payload,
      id: row.id,
      action_id: row.action_id,
      story_id: row.story_id,
      run_guid: row.run_guid,
      story_run_guid: payload.story_run_guid || row.run_guid || null,
      level: row.level,
      message: row.message,
      created_at: row.created_at
    };
  });
}

async function getDebugSummary(storyId, { runGuid = null, sinceIso = null } = {}) {
  const [eventRows, logRows] = await Promise.all([
    getEvents(storyId, null, 5000, 0, runGuid, sinceIso),
    getLogs(storyId, null, 5000, 0, runGuid, sinceIso),
  ]);

  return {
    story_id: storyId,
    run_guid: runGuid,
    since_iso: sinceIso,
    events: eventRows,
    logs: logRows,
  };
}

async function saveInvestigation(investigation) {
  const now = investigation.updated_at || new Date().toISOString();
  const createdAt = investigation.created_at || now;
  const id = investigation.id || `inv_${Date.now()}`;

  await run(`
    INSERT INTO investigations (id, name, tenant, story_id, mode, draft_id, created_at, updated_at, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      tenant = EXCLUDED.tenant,
      story_id = EXCLUDED.story_id,
      mode = EXCLUDED.mode,
      draft_id = EXCLUDED.draft_id,
      updated_at = EXCLUDED.updated_at,
      payload_json = EXCLUDED.payload_json
  `, [
    id,
    investigation.name,
    investigation.tenant || null,
    investigation.story_id,
    investigation.mode || null,
    investigation.draft_id || null,
    createdAt,
    now,
    JSON.stringify({ ...investigation, id, created_at: createdAt, updated_at: now })
  ]);

  return getInvestigation(id);
}

async function listInvestigations({ storyId = null, limit = 50 } = {}) {
  let sql = 'SELECT * FROM investigations';
  const params = [];
  if (storyId != null) {
    sql += ' WHERE story_id = ?';
    params.push(storyId);
  }
  sql += ' ORDER BY updated_at DESC LIMIT ?';
  params.push(limit);

  const rows = await query(sql, params);
  return rows.map((row) => {
    const payload = row.payload_json ? JSON.parse(row.payload_json) : {};
    return {
      ...payload,
      id: row.id,
      name: row.name,
      tenant: row.tenant,
      story_id: row.story_id,
      mode: row.mode,
      draft_id: row.draft_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  });
}

async function getInvestigation(id) {
  const rows = await query('SELECT * FROM investigations WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) return null;
  const row = rows[0];
  const payload = row.payload_json ? JSON.parse(row.payload_json) : {};
  return {
    ...payload,
    id: row.id,
    name: row.name,
    tenant: row.tenant,
    story_id: row.story_id,
    mode: row.mode,
    draft_id: row.draft_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function deleteInvestigation(id) {
  await run('DELETE FROM investigations WHERE id = ?', [id]);
}

module.exports = {
  init,
  clearDatabase,
  saveEvents,
  saveLogs,
  getEvents,
  getLogs,
  getDebugSummary,
  saveInvestigation,
  listInvestigations,
  getInvestigation,
  deleteInvestigation
};
