/* 旧「宿題提出スキャナー」データを新形式へコピーする移行処理。
 * 旧キーは削除・変更しません。移行先にデータがあれば中止します。
 */
(function (global) {
  "use strict";

  const OLD = {
    tasksV2: "hs_tasks_v2",
    dataV2Prefix: "hs_data_v2_",
    sizeV2: "hs_size_v2",
    prefixV2: "hs_prefix_v2",
    tasksV1: "hs_tasks_v1",
    dataV1Prefix: "hs_data_v1_",
    sizeV1: "hs_size_v1",
    prefixV1: "hs_prefix_v1",
    drills: "hs_drills_v1"
  };

  function parseJSON(raw, label) {
    if (raw === null) return null;
    try { return JSON.parse(raw); }
    catch (_) { throw new Error(`${label}の形式を読み取れません。旧データは変更していません。`); }
  }

  function listFrom(value) {
    return Array.isArray(value) ? value : [];
  }

  function migrate(options) {
    const identity = {
      schoolYear: 2026,
      grade: Number(options.grade),
      classNumber: Number(options.classNumber)
    };
    const targetKey = LPMStorage.datasetKey(identity.schoolYear, identity.grade, identity.classNumber);

    if (localStorage.getItem(targetKey) !== null) {
      throw new Error("移行先にデータが既にあります。安全のため移行を中止しました。");
    }

    const tasksRaw = localStorage.getItem(OLD.tasksV2);
    const tasksV1Raw = localStorage.getItem(OLD.tasksV1);
    const tasks = parseJSON(tasksRaw !== null ? tasksRaw : tasksV1Raw, "宿題一覧") || [];
    const legacyVersion = tasksRaw !== null ? "v2" : "v1";
    const dataPrefix = legacyVersion === "v2" ? OLD.dataV2Prefix : OLD.dataV1Prefix;
    const sizeRaw = localStorage.getItem(legacyVersion === "v2" ? OLD.sizeV2 : OLD.sizeV1);
    const prefixRaw = localStorage.getItem(legacyVersion === "v2" ? OLD.prefixV2 : OLD.prefixV1);
    const classSize = Number(sizeRaw || options.classSize || 30);
    const qrPrefix = String(prefixRaw || options.qrPrefix || `${identity.grade}${identity.classNumber}`);

    const homework = [];
    let submittedCount = 0;
    let absentCount = 0;
    let conflictCount = 0;

    for (const task of listFrom(tasks)) {
      const taskId = String(task.id || `legacy-${homework.length + 1}`);
      const dates = [];
      for (const dateValue of listFrom(task.dates)) {
        const date = String(dateValue);
        const dataKey = `${dataPrefix}${taskId}_${date}`;
        const dayData = parseJSON(localStorage.getItem(dataKey), `提出記録（${task.name || taskId}・${date}）`) || {};
        const submitted = dayData.submitted && typeof dayData.submitted === "object" ? dayData.submitted : {};
        const absent = new Set(listFrom(dayData.absent).map(String));
        const students = {};

        for (const [studentId, record] of Object.entries(submitted)) {
          if (absent.has(String(studentId))) {
            conflictCount++;
            continue; // 欠席を優先し、矛盾した提出済み状態を作らない。
          }
          students[String(studentId).padStart(2, "0")] = {
            status: "submitted",
            method: "legacy",
            submittedAt: record && record.time ? `${date}T${record.time}` : null,
            legacyTime: record && record.time ? String(record.time) : null
          };
          submittedCount++;
        }
        for (const studentId of absent) {
          students[String(studentId).padStart(2, "0")] = { status: "absent" };
          absentCount++;
        }

        dates.push({
          id: `legacy-date-${taskId}-${date}`,
          date,
          excludedStudents: [],
          students
        });
      }

      homework.push({
        id: taskId,
        name: String(task.name || "名称未設定"),
        excludedStudents: listFrom(task.targetOff).map(v => String(v).padStart(2, "0")),
        dates
      });
    }

    const drillRaw = parseJSON(localStorage.getItem(OLD.drills), "ドリル回収データ") || [];
    const drills = listFrom(drillRaw).map((drill, index) => {
      const submitted = drill.submitted && typeof drill.submitted === "object" ? drill.submitted : {};
      const students = {};
      for (const [studentId, record] of Object.entries(submitted)) {
        students[String(studentId).padStart(2, "0")] = {
          status: "submitted",
          method: "legacy",
          submittedAt: record && record.time ? `${drill.date || ""}T${record.time}` : null,
          legacyTime: record && record.time ? String(record.time) : null
        };
      }
      return {
        id: String(drill.id || `legacy-drill-${index + 1}`),
        name: String(drill.name || "名称未設定"),
        date: String(drill.date || ""),
        submitted: students,
        closed: Boolean(drill.closed)
      };
    });

    const dataset = {
      schemaVersion: LPMStorage.SCHEMA_VERSION,
      schoolYear: 2026,
      classSettings: {
        grade: identity.grade,
        classNumber: identity.classNumber,
        classSize,
        qrPrefix
      },
      homework,
      drills,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      migration: {
        status: "copied-from-legacy",
        source: legacyVersion,
        migratedAt: new Date().toISOString(),
        summary: {
          homeworkCount: homework.length,
          homeworkDateCount: homework.reduce((n, h) => n + h.dates.length, 0),
          submittedCount,
          absentCount,
          conflictingAbsentAndSubmittedCount: conflictCount,
          drillCount: drills.length
        }
      }
    };

    // 先に新形式データを書き込み、旧データは一切削除しない。
    LPMStorage.saveDataset(identity, dataset);
    const settings = LPMStorage.getSettings();
    LPMStorage.saveSettings({
      ...settings,
      schoolYear: 2026,
      grade: identity.grade,
      classNumber: identity.classNumber,
      classSize,
      qrPrefix
    });

    return dataset.migration.summary;
  }

  global.LPMigration = { migrate, OLD_KEYS: OLD };
})(window);
