import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import mysql from 'mysql2/promise'
import {
  InMemoryObservabilitySink,
  QUARTER_GROUPS,
  SectionPlacementEngine
} from 'scheduler-library'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: 'mysql-api',
      configureServer(server) {
        const pool = mysql.createPool({
          host: '192.168.1.172',
          user: 'admin',
          password: 'admin',
          database: 'edario',
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0
        });

        async function getRawDataset(schoolId, svId) {
          const formatTeacherName = (teacherRow) => {
            const lastName = (teacherRow?.name || '').toString().trim();
            const firstName = (teacherRow?.first_name || teacherRow?.firstname || teacherRow?.firstName || '').toString().trim();
            if (lastName && firstName) return `${lastName}, ${firstName}`;
            return lastName || firstName || 'Unknown Teacher';
          };

          const [[version]] = await pool.execute('SELECT data_version_id FROM schedule_versions WHERE schedule_version_id = ?', [svId]);
          const dvId = version?.data_version_id;

          const fetchTable = async (table, where = '1=1', params = []) => {
            const [rows] = await pool.execute(`SELECT * FROM ${table} WHERE ${where}`, params);
            return rows;
          };

          const [courses, classrooms, teachers, students, sections, studentRequests, requestGroups, scheduleStructure, lunches, settings, schedulePeriods, coursePeriodsData] = await Promise.all([
            pool.execute(`SELECT c.* FROM courses c JOIN course_versions cv ON c.course_id = cv.course_id WHERE c.school_id = ? AND cv.data_version_id = ? AND c.is_deleted = 0 AND cv.is_deleted = 0`, [schoolId, dvId]).then(([r]) => r),
            pool.execute(`SELECT cl.* FROM classrooms cl JOIN classroom_versions cv ON cl.classroom_id = cv.classroom_id WHERE cl.school_id = ? AND cv.data_version_id = ? AND cl.is_deleted = 0 AND cv.is_deleted = 0`, [schoolId, dvId]).then(([r]) => r),
            pool.execute(`SELECT t.* FROM teachers t JOIN teacher_versions tv ON t.teacher_id = tv.teacher_id WHERE t.school_id = ? AND tv.data_version_id = ? AND t.is_deleted = 0 AND tv.is_deleted = 0`, [schoolId, dvId]).then(([r]) => r),
            pool.execute(`SELECT s.* FROM students s JOIN student_versions sv ON s.id = sv.student_id WHERE s.school_id = ? AND sv.data_version_id = ? AND s.is_deleted = 0 AND sv.is_deleted = 0`, [schoolId, dvId]).then(([r]) => r),
            fetchTable('sections', 'school_id = ? AND schedule_version_id = ? AND is_deleted = 0', [schoolId, svId]),
            fetchTable('student_requests', 'school_id = ? AND schedule_version_id = ? AND is_deleted = 0', [schoolId, svId]),
            fetchTable('request_group', 'schedule_version_id = ?', [svId]),
            fetchTable('schedule_structure', 'school_id = ? AND schedule_version_id = ? AND is_deleted = 0', [schoolId, svId]),
            fetchTable('lunches', 'school_id = ? AND schedule_version_id = ? AND is_deleted = 0', [schoolId, svId]),
            fetchTable('schedule_settings', 'school_id = ? AND schedule_version_id = ?', [schoolId, svId]),
            fetchTable('schedule_periods', 'school_id = ? AND schedule_version_id = ? AND is_deleted = 0', [schoolId, svId]),
            fetchTable('course_periods', 'school_id = ? AND schedule_version_id = ? AND is_deleted = 0', [schoolId, svId])
          ]);

          const [courseOptions, classroomDepts, courseDepts, teacherDepts, teacherPeriods, studentOptions, sectionCoursePeriods, sectionsQuarterDay, studentSchedules, sectionSpans, subsections, sectionSecondaryTeachers] = await Promise.all([
            fetchTable('course_options', 'school_id = ? AND schedule_version_id = ?', [schoolId, svId]),
            fetchTable('data_departments', 'school_id = ? AND schedule_version_id = ? AND data_type = 1 AND is_deleted = 0', [schoolId, svId]),
            fetchTable('data_departments', 'school_id = ? AND schedule_version_id = ? AND data_type = 2 AND is_deleted = 0', [schoolId, svId]),
            fetchTable('data_departments', 'school_id = ? AND schedule_version_id = ? AND data_type = 4 AND is_deleted = 0', [schoolId, svId]),
            fetchTable('teacher_period_restrictions', 'school_id = ? AND schedule_version_id = ? AND is_deleted = 0', [schoolId, svId]),
            fetchTable('student_options', 'school_id = ? AND schedule_version_id = ?', [schoolId, svId]),
            fetchTable('section_course_periods', 'school_id = ? AND schedule_version_id = ?', [schoolId, svId]),
            fetchTable('sections_quarter_day', 'school_id = ? AND schedule_version_id = ?', [schoolId, svId]),
            fetchTable('student_schedules', 'school_id = ? AND schedule_version_id = ? AND is_deleted = 0', [schoolId, svId]),
            fetchTable('sections_span', 'school_id = ? AND schedule_version_id = ? AND is_deleted = 0', [schoolId, svId]),
            fetchTable('sections_subsection', 'school_id = ? AND schedule_version_id = ? AND is_deleted = 0', [schoolId, svId]),
            fetchTable('section_secondary_teachers', 'school_id = ? AND schedule_version_id = ?', [schoolId, svId])
          ]);

          const [lunchDays] = await pool.execute('SELECT ld.* FROM lunch_days ld JOIN lunches l ON ld.lunch_id = l.lunch_id WHERE l.school_id = ? AND l.schedule_version_id = ? AND l.is_deleted = 0', [schoolId, svId]);

          return {
            courses: courses.map(c => {
              const opt = courseOptions.find(o => o.course_id === c.course_id);
              return {
                courseId: c.course_id,
                name: c.name,
                courseCode: c.course_code,
                semester: opt?.semester || null,
                capacity: opt?.capacity || 25,
                priority: opt?.priority || 10,
                departments: courseDepts.filter(d => d.data_id === c.course_id).map(d => d.department_id),
                quarterLength: QUARTER_GROUPS[opt?.semester] || QUARTER_GROUPS.FY,
                spanLength: opt?.span_length || 1,
                allowInclusion: !!opt?.allow_icr_students,
                isLunchCourse: !!opt?.is_lunch
              };
            }),
            classrooms: classrooms.map(cl => ({
              classroomId: cl.classroom_id,
              name: cl.classroom_name,
              departments: classroomDepts.filter(d => d.data_id === cl.classroom_id).map(d => d.department_id),
              capacity: 30
            })),
            teachers: teachers.map(t => ({
              teacherId: t.teacher_id,
              name: formatTeacherName(t),
              departments: teacherDepts.filter(d => d.data_id === t.teacher_id).map(d => d.department_id),
              restrictedCoursePeriods: teacherPeriods.filter(r => r.teacher_id === t.teacher_id).map(r => r.course_period_id)
            })),
            students: students.map(s => {
              const opt = studentOptions.find(o => o.student_id === s.id);
              const displayName = s.name || [s.first_name, s.last_name].filter(Boolean).join(' ') || String(s.id);
              return {
                studentId: s.id,
                name: displayName,
                grade: opt?.grade || '',
                inclusion: !!opt?.is_special_ed
              };
            }),
            sections: sections.map(s => {
              const periods = sectionCoursePeriods.filter(scp => scp.section_id === s.section_id).map(scp => scp.course_period_id);
              const teacher = teachers.find(t => t.teacher_id === s.teacher_id);
              const course = courses.find(c => c.course_id === s.course_id);
              const room = classrooms.find(cl => cl.classroom_id === s.classroom_id);

              const qRows = sectionsQuarterDay.filter(sqd => sqd.section_id === s.section_id);
              const quarters = Array.from(new Set(qRows.map(r => r.quarter))).sort();

              // Map to quartersDays format using specific day/quarter data from the database
              const maxDay = Math.max(...scheduleStructure.map(ss => ss.day), 0);
              const quartersDays = Array.from({ length: maxDay }, () => []);
              const daysList = [];

              qRows.forEach(row => {
                const dayIdx = row.day - 1;
                if (dayIdx >= 0 && dayIdx < maxDay) {
                  if (!quartersDays[dayIdx].includes(row.quarter)) {
                    quartersDays[dayIdx].push(row.quarter);
                  }
                  if (!daysList.includes(row.day)) {
                    daysList.push(row.day);
                  }
                }
              });

              // Ensure sorted
              quartersDays.forEach(qArr => qArr.sort());

              const spanEntry = sectionSpans.find(ss => ss.section_id === s.section_id);
              const subsectionEntry = subsections.find(sub => sub.subsection_id === s.section_id);
              const secondaryTeacherIds = sectionSecondaryTeachers
                .filter(row => row.section_id === s.section_id)
                .map(row => row.teacher_id)
                .filter(id => id != null);
              const teacherIds = Array.from(new Set([s.teacher_id, ...secondaryTeacherIds].filter(id => id != null)));
              const scheduledStudentIds = studentSchedules
                .filter(ss => ss.section_id === s.section_id)
                .map(ss => ss.student_id);

              return {
                sectionId: s.section_id,
                courseId: s.course_id,
                teacherId: s.teacher_id,
                teacherIds,
                coTeacherIds: secondaryTeacherIds,
                isCoTaught: secondaryTeacherIds.length > 0,
                classroomId: s.classroom_id,
                coursePeriodIds: periods.length > 0 ? periods : undefined,
                locked: !!s.locked,
                isLab: !!s.is_lab,
                isInclusion: !!s.is_inclusion,
                quartersDays: quartersDays,
                days: daysList.sort().join(','),
                spanId: spanEntry?.span_id,
                parentSectionId: subsectionEntry?.section_id,
                // UI helper fields (not strictly in RawSection but useful for UI state)
                course_name: course?.name || 'Unknown Course',
                courseCode: course?.course_code || 'N/A',
                teacher_name: formatTeacherName(teacher),
                room_name: room?.classroom_name || 'N/A',
                student_count: scheduledStudentIds.length,
                scheduledStudentIds,
                quarters: quarters.join(',')
              };
            }),
            studentRequests: studentRequests.map(r => ({
              studentId: r.student_id,
              courseId: r.course_id,
              groupId: r.request_group_id,
              order: r.order,
              isInclusion: !!r.is_inclusion
            })),
            requestGroups: requestGroups.map(g => ({
              groupId: g.id,
              priority: g.priority
            })),
            scheduleStructure: scheduleStructure.map(ss => {
              const sp = schedulePeriods.find(p => p.schedule_period_id === ss.schedule_period_id);
              const cp = coursePeriodsData.find(p => p.course_period_id === ss.course_period_id);
              return {
                coursePeriodId: ss.course_period_id,
                day: ss.day,
                startTime: sp?.start_time || '08:00:00',
                endTime: sp?.end_time || '09:00:00',
                name: cp?.course_period_name
              };
            }),
            coursePeriods: coursePeriodsData.map(cp => ({
              coursePeriodId: cp.course_period_id,
              name: cp.course_period_name
            })),
            lunches: lunches.map(l => ({
              lunchId: l.lunch_id,
              startTime: l.start_time,
              endTime: l.end_time,
              days: lunchDays.filter(ld => ld.lunch_id === l.lunch_id).map(ld => ld.day)
            })),
            settings: settings[0] ? {
              maxInARow: settings[0].max_classes_in_a_row,
            } : undefined
          };
        }

        function getStrategyDescriptors(rawDataset) {
          const engine = new SectionPlacementEngine(rawDataset);
          return engine.getAvailableStrategyDescriptors();
        }

        server.middlewares.use(async (req, res, next) => {
          if (req.url.startsWith('/api/')) {
            res.setHeader('Content-Type', 'application/json');

            if (req.method === 'POST' && req.url === '/api/place-sections') {
              try {
                let body = '';
                await new Promise((resolve, reject) => {
                  req.on('data', chunk => body += chunk);
                  req.on('end', resolve);
                  req.on('error', reject);
                });

                const {
                  dataset: incomingDataset,
                  engineOptions: incomingEngineOptions
                } = JSON.parse(body);

                const engineOptions =
                  incomingEngineOptions && typeof incomingEngineOptions === 'object'
                    ? incomingEngineOptions
                    : {};

                const diagnosticSink = new InMemoryObservabilitySink()
                const decisionSink = new InMemoryObservabilitySink()
                const engine = new SectionPlacementEngine(incomingDataset, {
                  engineSettings: incomingEngineOptions.engineSettings,
                  randomSeed: engineOptions.randomSeed,
                  strategyPipeline: engineOptions.strategyPipeline,
                  observability: {
                    diagnosticSinks: [diagnosticSink],
                    decisionSinks: [decisionSink]
                  }
                });
                const result = await engine.run()

                // Map results back to UI format
                const updatedSections = incomingDataset.sections.map(uiS => {
                  const placed = result.placedSections.find(ps => ps.sectionId === uiS.sectionId);
                  const classroomId = placed ? placed.classroomId : uiS.classroomId;
                  const room = incomingDataset.classrooms.find(c => c.classroomId === classroomId);
                  const roomName = room ? room.name : 'N/A';

                  if (placed) {
                    const quarters = Array.from(new Set((placed.quartersDays || []).flat())).sort();
                    const daysList = [];
                    (placed.quartersDays || []).forEach((qArr, idx) => {
                      if (qArr.length > 0) daysList.push(idx + 1);
                    });

                    return {
                      ...uiS,
                      course_period_ids: placed.coursePeriodIds || [],
                      quarters: quarters.join(','),
                      days: daysList.join(','),
                      locked: placed.locked,
                      quarters_days: placed.quartersDays,
                      // Ensure field names are consistent with UI expectation
                      section_id: uiS.sectionId,
                      course_id: uiS.courseId,
                      teacher_id: uiS.teacherId,
                      classroom_id: classroomId,
                      room_name: roomName
                    };
                  }
                  return {
                    ...uiS,
                    section_id: uiS.sectionId,
                    course_id: uiS.courseId,
                    teacher_id: uiS.teacherId,
                    classroom_id: classroomId,
                    room_name: roomName,
                    course_period_ids: [],
                    quarters_days: null,
                    quarters: null,
                    days: ''
                  };
                });

                return res.end(JSON.stringify({
                  sections: updatedSections,
                  observability: {
                    sectionDiagnostics: diagnosticSink.records,
                    sectionDecisions: decisionSink.records,
                    studentDiagnostics: [],
                    studentDecisions: []
                  },
                  observabilityOutcome: result.observabilityOutcome
                }));
              } catch (err) {
                console.error('Placement Error:', err);
                res.statusCode = 500;
                return res.end(JSON.stringify({ error: err.message }));
              }
            }

            try {
              if (req.url === '/api/schools') {
                const [rows] = await pool.execute('SELECT school_id, name FROM schools WHERE is_deleted = 0');
                return res.end(JSON.stringify(rows));
              }

              if (req.url.startsWith('/api/versions?')) {
                const params = new URLSearchParams(req.url.split('?')[1]);
                const schoolId = params.get('schoolId');
                const [rows] = await pool.execute('SELECT schedule_version_id, schedule_name, data_version_id FROM schedule_versions WHERE school_id = ? AND is_deleted = 0', [schoolId]);
                return res.end(JSON.stringify(rows));
              }

              if (req.url.startsWith('/api/full-dataset?')) {
                const params = new URLSearchParams(req.url.split('?')[1]);
                const schoolId = params.get('schoolId');
                const svId = params.get('svId');
                const dataset = await getRawDataset(schoolId, svId);
                return res.end(JSON.stringify({
                  ...dataset,
                  strategyDescriptors: getStrategyDescriptors(dataset)
                }));
              }

              res.statusCode = 404;
              return res.end(JSON.stringify({ error: 'Not found' }));
            } catch (err) {
              console.error('API Error:', err);
              res.statusCode = 500;
              return res.end(JSON.stringify({ error: err.message }));
            }
          }
          next();
        });
      }
    }
  ],
})
