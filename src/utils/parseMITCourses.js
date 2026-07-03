export function parseMITCourses(content) {
  const result = { topic: '', courses: [] };
  if (!content) return result;

  let current = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (line.startsWith('TOPIC:')) {
      result.topic = line.slice(6).trim();
    } else if (line.startsWith('COURSE:')) {
      if (current && current.courseNum) result.courses.push(current);
      current = { courseNum: line.slice(7).trim(), title: '', level: '', department: '', term: '', description: '' };
    } else if (current) {
      if (line.startsWith('TITLE:')) current.title = line.slice(6).trim();
      else if (line.startsWith('LEVEL:')) current.level = line.slice(6).trim();
      else if (line.startsWith('DEPARTMENT:')) current.department = line.slice(11).trim();
      else if (line.startsWith('TERM:')) current.term = line.slice(5).trim();
      else if (line.startsWith('DESCRIPTION:')) current.description = line.slice(12).trim();
    }
  }

  if (current && current.courseNum) result.courses.push(current);
  return result;
}
