import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
const connection = await mysql.createConnection(dbUrl);

// clients 테이블 데이터 추출
const [clientsRows] = await connection.execute('SELECT * FROM clients');
const [projectsRows] = await connection.execute('SELECT * FROM projects');
const [generationsRows] = await connection.execute('SELECT * FROM generations');

await connection.end();

// SQL 파일 생성
let sqlContent = '-- Database Backup\n-- Generated at ' + new Date().toISOString() + '\n\n';

// clients 테이블
if (clientsRows.length > 0) {
  sqlContent += '-- ===== CLIENTS TABLE =====\n';
  for (const row of clientsRows) {
    const values = [
      row.id,
      row.userId,
      `'${row.name.replace(/'/g, "''")}'`,
      `'${row.gender}'`,
      row.phone ? `'${row.phone.replace(/'/g, "''")}'` : 'NULL',
      row.email ? `'${row.email.replace(/'/g, "''")}'` : 'NULL',
      row.consultationNotes ? `'${row.consultationNotes.replace(/'/g, "''")}'` : 'NULL',
      row.preferredConcept ? `'${row.preferredConcept.replace(/'/g, "''")}'` : 'NULL',
      `'${row.status}'`,
      row.tags ? `'${JSON.stringify(row.tags).replace(/'/g, "''")}'` : 'NULL',
      row.partnerId || 'NULL',
      `'${row.createdAt.toISOString().slice(0, 19).replace('T', ' ')}'`,
      `'${row.updatedAt.toISOString().slice(0, 19).replace('T', ' ')}'`
    ];
    sqlContent += `INSERT INTO clients (id, userId, name, gender, phone, email, consultationNotes, preferredConcept, status, tags, partnerId, createdAt, updatedAt) VALUES (${values.join(', ')});\n`;
  }
  sqlContent += '\n';
}

// projects 테이블
if (projectsRows.length > 0) {
  sqlContent += '-- ===== PROJECTS TABLE =====\n';
  for (const row of projectsRows) {
    const values = [
      row.id,
      row.clientId,
      row.userId,
      `'${row.title.replace(/'/g, "''")}'`,
      `'${row.category}'`,
      row.concept ? `'${row.concept.replace(/'/g, "''")}'` : 'NULL',
      `'${row.status}'`,
      row.referenceImageUrl ? `'${row.referenceImageUrl.replace(/'/g, "''")}'` : 'NULL',
      row.referenceImageKey ? `'${row.referenceImageKey.replace(/'/g, "''")}'` : 'NULL',
      row.pinterestUrl ? `'${row.pinterestUrl.replace(/'/g, "''")}'` : 'NULL',
      row.notes ? `'${row.notes.replace(/'/g, "''")}'` : 'NULL',
      `'${row.priority}'`,
      row.partnerClientId || 'NULL',
      `'${row.projectMode}'`,
      `'${row.createdAt.toISOString().slice(0, 19).replace('T', ' ')}'`,
      `'${row.updatedAt.toISOString().slice(0, 19).replace('T', ' ')}'`
    ];
    sqlContent += `INSERT INTO projects (id, clientId, userId, title, category, concept, status, referenceImageUrl, referenceImageKey, pinterestUrl, notes, priority, partnerClientId, projectMode, createdAt, updatedAt) VALUES (${values.join(', ')});\n`;
  }
  sqlContent += '\n';
}

// generations 테이블
if (generationsRows.length > 0) {
  sqlContent += '-- ===== GENERATIONS TABLE =====\n';
  for (const row of generationsRows) {
    const values = [
      row.id,
      row.projectId,
      row.promptId || 'NULL',
      `'${row.promptText.replace(/'/g, "''")}'`,
      row.negativePrompt ? `'${row.negativePrompt.replace(/'/g, "''")}'` : 'NULL',
      row.parameters ? `'${JSON.stringify(row.parameters).replace(/'/g, "''")}'` : 'NULL',
      row.resultImageUrl ? `'${row.resultImageUrl.replace(/'/g, "''")}'` : 'NULL',
      row.resultImageKey ? `'${row.resultImageKey.replace(/'/g, "''")}'` : 'NULL',
      `'${row.status}'`,
      row.qualityScore || 'NULL',
      row.faceConsistencyScore || 'NULL',
      row.reviewNotes ? `'${row.reviewNotes.replace(/'/g, "''")}'` : 'NULL',
      `'${row.stage}'`,
      row.upscaledImageUrl ? `'${row.upscaledImageUrl.replace(/'/g, "''")}'` : 'NULL',
      row.upscaledImageKey ? `'${row.upscaledImageKey.replace(/'/g, "''")}'` : 'NULL',
      row.generationTimeMs || 'NULL',
      row.merchandiseFormat ? `'${row.merchandiseFormat.replace(/'/g, "''")}'` : 'NULL',
      row.outputWidth || 'NULL',
      row.outputHeight || 'NULL',
      `'${row.createdAt.toISOString().slice(0, 19).replace('T', ' ')}'`,
      `'${row.updatedAt.toISOString().slice(0, 19).replace('T', ' ')}'`
    ];
    sqlContent += `INSERT INTO generations (id, projectId, promptId, promptText, negativePrompt, parameters, resultImageUrl, resultImageKey, status, qualityScore, faceConsistencyScore, reviewNotes, stage, upscaledImageUrl, upscaledImageKey, generationTimeMs, merchandiseFormat, outputWidth, outputHeight, createdAt, updatedAt) VALUES (${values.join(', ')});\n`;
  }
  sqlContent += '\n';
}

// 파일로 저장
import fs from 'fs';
fs.writeFileSync('/home/ubuntu/one_ai_studio_pro/backup.sql', sqlContent);
console.log('Backup file created: /home/ubuntu/one_ai_studio_pro/backup.sql');
console.log(`Total records: clients=${clientsRows.length}, projects=${projectsRows.length}, generations=${generationsRows.length}`);
