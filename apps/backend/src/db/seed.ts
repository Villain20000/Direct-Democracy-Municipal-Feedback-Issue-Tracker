import { PrismaClient, UserRole, IssueCategory, IssueStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 12);

  // Create departments
  const departments = await Promise.all([
    prisma.department.create({ data: { name: 'Public Works', code: 'PW', description: 'Roads, bridges, and infrastructure', budget: 5000000 } }),
    prisma.department.create({ data: { name: 'Sanitation', code: 'SAN', description: 'Waste management and recycling', budget: 3000000 } }),
    prisma.department.create({ data: { name: 'Public Safety', code: 'PS', description: 'Police and emergency services', budget: 12000000 } }),
    prisma.department.create({ data: { name: 'Parks & Recreation', code: 'PR', description: 'Parks, trails, and community centers', budget: 2500000 } }),
    prisma.department.create({ data: { name: 'Utilities', code: 'UT', description: 'Water, sewer, and electric', budget: 8000000 } }),
    prisma.department.create({ data: { name: 'Housing', code: 'HO', description: 'Affordable housing and development', budget: 6000000 } }),
    prisma.department.create({ data: { name: 'Transportation', code: 'TR', description: 'Traffic, transit, and bike lanes', budget: 4000000 } }),
    prisma.department.create({ data: { name: 'Health & Human Services', code: 'HHS', description: 'Public health and social services', budget: 7000000 } }),
  ]);

  // Create wards
  const wards = await Promise.all([
    prisma.ward.create({ data: { name: 'Downtown', code: 'WD-01', description: 'City center and business district' } }),
    prisma.ward.create({ data: { name: 'Northside', code: 'WD-02', description: 'Residential northern neighborhood' } }),
    prisma.ward.create({ data: { name: 'Eastview', code: 'WD-03', description: 'Eastern suburban area' } }),
    prisma.ward.create({ data: { name: 'Southgate', code: 'WD-04', description: 'Southern gateway district' } }),
    prisma.ward.create({ data: { name: 'Westfield', code: 'WD-05', description: 'Western residential community' } }),
    prisma.ward.create({ data: { name: 'Riverside', code: 'WD-06', description: 'Riverfront area' } }),
  ]);

  // Create users with different roles
  const users = await Promise.all([
    prisma.user.create({ data: { email: 'admin@city.gov', passwordHash, firstName: 'System', lastName: 'Administrator', role: UserRole.SUPER_ADMIN } }),                    // 0
    prisma.user.create({ data: { email: 'mayor@city.gov', passwordHash, firstName: 'Sarah', lastName: 'Mitchell', role: UserRole.MAYOR } }),                                   // 1
    prisma.user.create({ data: { email: 'pw.head@city.gov', passwordHash, firstName: 'James', lastName: 'Rodriguez', role: UserRole.DEPARTMENT_HEAD, departmentId: departments[0].id } }),    // 2
    prisma.user.create({ data: { email: 'san.head@city.gov', passwordHash, firstName: 'Maria', lastName: 'Garcia', role: UserRole.DEPARTMENT_HEAD, departmentId: departments[1].id } }),     // 3
    prisma.user.create({ data: { email: 'council1@city.gov', passwordHash, firstName: 'David', lastName: 'Chen', role: UserRole.COUNCIL_MEMBER, wardId: wards[0].id } }),                   // 4
    prisma.user.create({ data: { email: 'council2@city.gov', passwordHash, firstName: 'Lisa', lastName: 'Thompson', role: UserRole.COUNCIL_MEMBER, wardId: wards[1].id } }),                 // 5
    prisma.user.create({ data: { email: 'council3@city.gov', passwordHash, firstName: 'Robert', lastName: 'Johnson', role: UserRole.COUNCIL_MEMBER, wardId: wards[2].id } }),                // 6
    prisma.user.create({ data: { email: 'staff1@city.gov', passwordHash, firstName: 'Tom', lastName: 'Wilson', role: UserRole.STAFF, departmentId: departments[0].id, wardId: wards[0].id } }), // 7
    prisma.user.create({ data: { email: 'staff2@city.gov', passwordHash, firstName: 'Emily', lastName: 'Davis', role: UserRole.STAFF, departmentId: departments[1].id, wardId: wards[1].id } }), // 8
    prisma.user.create({ data: { email: 'wardrep1@city.gov', passwordHash, firstName: 'Angela', lastName: 'Martinez', role: UserRole.WARD_REP, wardId: wards[3].id } }),                     // 9
    prisma.user.create({ data: { email: 'citizen1@email.com', passwordHash, firstName: 'John', lastName: 'Smith', role: UserRole.CITIZEN, wardId: wards[0].id } }),                           // 10
    prisma.user.create({ data: { email: 'citizen2@email.com', passwordHash, firstName: 'Jane', lastName: 'Doe', role: UserRole.CITIZEN, wardId: wards[1].id } }),                             // 11
    prisma.user.create({ data: { email: 'citizen3@email.com', passwordHash, firstName: 'Mike', lastName: 'Brown', role: UserRole.CITIZEN, wardId: wards[2].id } }),                           // 12
    prisma.user.create({ data: { email: 'volunteer1@email.com', passwordHash, firstName: 'Sarah', lastName: 'Lee', role: UserRole.VOLUNTEER, wardId: wards[4].id } }),                         // 13
    prisma.user.create({ data: { email: 'auditor@city.gov', passwordHash, firstName: 'Patricia', lastName: 'Wilson', role: UserRole.AUDITOR } }),                                                // 14
    prisma.user.create({ data: { email: 'press@herald.com', passwordHash, firstName: 'Michael', lastName: 'Clark', role: UserRole.MEDIA } }),                                                     // 15
  ]);

  // Wire department heads via headId (one-to-one relationship)
  await Promise.all([
    prisma.department.update({ where: { id: departments[0].id }, data: { headId: users[2].id } }),  // Public Works → James Rodriguez
    prisma.department.update({ where: { id: departments[1].id }, data: { headId: users[3].id } }),  // Sanitation → Maria Garcia
  ]);
  console.log('  ✅ Department heads linked');

  // Wire ward representative via representativeId (one-to-one relationship)
  await Promise.all([
    prisma.ward.update({ where: { id: wards[3].id }, data: { representativeId: users[9].id } }),  // Southgate → Angela Martinez
  ]);
  console.log('  ✅ Ward representative linked');

  // Create issues
  const issues = await Promise.all([
    prisma.issue.create({ data: { title: 'Large pothole on Main Street', description: 'There is a large pothole at the intersection of Main St and 5th Ave that has been growing for weeks. It is causing damage to vehicles and is a safety hazard.', category: IssueCategory.INFRASTRUCTURE, status: IssueStatus.IN_PROGRESS, priority: 4, location: 'Main St & 5th Ave', latitude: 40.7128, longitude: -74.0060, reporterId: users[10].id, assigneeId: users[7].id, departmentId: departments[0].id, wardId: wards[0].id, upvotes: 24, viewCount: 156 } }),
    prisma.issue.create({ data: { title: 'Broken streetlight on Oak Avenue', description: 'Streetlight #42 on Oak Avenue has been out for two weeks. The area is very dark at night and feels unsafe.', category: IssueCategory.INFRASTRUCTURE, status: IssueStatus.ACKNOWLEDGED, priority: 3, location: '1234 Oak Avenue', latitude: 40.7148, longitude: -74.0030, reporterId: users[11].id, departmentId: departments[0].id, wardId: wards[1].id, upvotes: 12, viewCount: 89 } }),
    prisma.issue.create({ data: { title: 'Illegal dumping in Riverside Park', description: 'Someone has been dumping construction debris and old furniture in the southeast corner of Riverside Park. This has been happening for the past month.', category: IssueCategory.SANITATION, status: IssueStatus.SUBMITTED, priority: 2, location: 'Riverside Park SE corner', latitude: 40.7108, longitude: -74.0160, reporterId: users[12].id, departmentId: departments[1].id, wardId: wards[5].id, upvotes: 8, viewCount: 45 } }),
    prisma.issue.create({ data: { title: 'Water main break on Cedar Lane', description: 'Water is gushing from a broken water main on Cedar Lane. The street is flooding and nearby homes may lose water pressure.', category: IssueCategory.UTILITIES, status: IssueStatus.IN_PROGRESS, priority: 5, location: 'Cedar Lane near School', latitude: 40.7200, longitude: -74.0000, reporterId: users[13].id, departmentId: departments[4].id, wardId: wards[3].id, upvotes: 42, viewCount: 312 } }),
    prisma.issue.create({ data: { title: 'Noise complaint - Construction hours', description: 'The construction project on 3rd Street starts at 6am, well before the allowed 7am start time. This has been happening every weekday for the past three weeks.', category: IssueCategory.OTHER, status: IssueStatus.ACKNOWLEDGED, priority: 2, location: '3rd Street Construction Site', reporterId: users[10].id, wardId: wards[2].id, upvotes: 15, viewCount: 67 } }),
    prisma.issue.create({ data: { title: 'Graffiti on community center wall', description: 'Large graffiti tags appeared on the north wall of the Westfield Community Center over the weekend. The artwork appears to be offensive.', category: IssueCategory.PUBLIC_SAFETY, status: IssueStatus.SUBMITTED, priority: 1, location: 'Westfield Community Center', latitude: 40.7180, longitude: -74.0120, reporterId: users[14].id, departmentId: departments[3].id, wardId: wards[4].id, upvotes: 6, viewCount: 34 } }),
    prisma.issue.create({ data: { title: 'Missing manhole cover on Park Boulevard', description: 'A manhole cover is missing from the intersection of Park Blvd and Elm St. This is extremely dangerous for both vehicles and pedestrians.', category: IssueCategory.INFRASTRUCTURE, status: IssueStatus.RESOLVED, priority: 5, location: 'Park Blvd & Elm St', latitude: 40.7160, longitude: -74.0080, reporterId: users[11].id, departmentId: departments[0].id, wardId: wards[0].id, upvotes: 38, viewCount: 267, resolvedAt: new Date() } }),
    prisma.issue.create({ data: { title: 'Tree blocking sidewalk on Maple Drive', description: 'A large tree branch fell during last week\'s storm and is completely blocking the sidewalk on Maple Drive. Wheelchair users cannot pass.', category: IssueCategory.ENVIRONMENT, status: IssueStatus.IN_PROGRESS, priority: 3, location: '456 Maple Drive', latitude: 40.7220, longitude: -74.0150, reporterId: users[13].id, departmentId: departments[3].id, wardId: wards[5].id, upvotes: 19, viewCount: 98 } }),
  ]);

  // Create comments
  await Promise.all([
    prisma.comment.create({ data: { content: 'This pothole damaged my tire last week. Definitely needs urgent attention.', userId: users[11].id, issueId: issues[0].id } }),
    prisma.comment.create({ data: { content: 'DPW has been notified. Repair crew scheduled for Thursday.', userId: users[7].id, issueId: issues[0].id } }),
    prisma.comment.create({ data: { content: 'I almost fell into this hole while walking at night. Very dangerous!', userId: users[12].id, issueId: issues[0].id } }),
    prisma.comment.create({ data: { content: 'The water main break is causing significant flooding. Please send emergency crew ASAP.', userId: users[10].id, issueId: issues[3].id } }),
    prisma.comment.create({ data: { content: 'Emergency repair team dispatched. Please avoid Cedar Lane area.', userId: users[8].id, issueId: issues[3].id } }),
  ]);

  // Create announcements
  await Promise.all([
    prisma.announcement.create({ data: { title: 'City Council Meeting - June 20, 2026', content: 'The next city council meeting will be held on June 20, 2026 at 7:00 PM in the City Hall Council Chamber. Public comment period will be available.', authorId: users[1].id, isPinned: true, publishedAt: new Date() } }),
    prisma.announcement.create({ data: { title: 'Summer Road Repair Program Begins', content: 'The Department of Public Works will begin its annual summer road repair program on June 25. Residents can expect lane closures on major thoroughfares.', authorId: users[2].id, publishedAt: new Date() } }),
    prisma.announcement.create({ data: { title: 'Community Cleanup Volunteer Day', content: 'Join us for the annual community cleanup day on July 4th. Volunteers will meet at City Hall at 8:00 AM. Refreshments and supplies provided.', authorId: users[9].id, publishedAt: new Date() } }),
  ]);

  // Create events
  await Promise.all([
    prisma.event.create({ data: { title: 'City Council Meeting', description: 'Regular city council meeting with public comment period', location: 'City Hall Council Chamber', startTime: new Date('2026-06-20T19:00:00Z'), endTime: new Date('2026-06-20T21:00:00Z'), creatorId: users[1].id, type: 'COUNCIL_MEETING', isPublic: true } }),
    prisma.event.create({ data: { title: 'Budget Public Hearing', description: 'Public hearing on the proposed 2027 fiscal year budget', location: 'Community Center Main Hall', startTime: new Date('2026-06-25T18:00:00Z'), endTime: new Date('2026-06-25T20:00:00Z'), creatorId: users[1].id, type: 'PUBLIC_HEARING', isPublic: true } }),
    prisma.event.create({ data: { title: 'Summer Community Cleanup', description: 'Annual community volunteer cleanup event', location: 'City Hall', startTime: new Date('2026-07-04T08:00:00Z'), endTime: new Date('2026-07-04T14:00:00Z'), creatorId: users[9].id, type: 'VOLUNTEER_EVENT', isPublic: true } }),
    prisma.event.create({ data: { title: 'Town Hall: Infrastructure Planning', description: 'Meet with department heads to discuss infrastructure priorities for the coming year', location: 'Downtown Library Auditorium', startTime: new Date('2026-07-10T19:00:00Z'), endTime: new Date('2026-07-10T21:00:00Z'), creatorId: users[2].id, type: 'TOWN_HALL', isPublic: true } }),
  ]);

  // Create resolutions
  await Promise.all([
    prisma.resolution.create({ data: { title: 'Allocate Emergency Funds for Water Main Repair', description: 'Resolution to allocate $150,000 from the emergency infrastructure fund for the Cedar Lane water main repair.', proposedById: users[4].id, status: 'PASSED', votesFor: 5, votesAgainst: 1, votedByIds: [users[4].id, users[5].id, users[6].id, users[1].id, users[0].id], decidedAt: new Date() } }),
    prisma.resolution.create({ data: { title: 'Expand Community Center Hours', description: 'Resolution to extend Westfield Community Center operating hours to 9 PM on weekdays.', proposedById: users[5].id, status: 'VOTING', votesFor: 2, votesAgainst: 0, votedByIds: [users[5].id, users[4].id] } }),
  ]);

  // Create polls
  const poll = await prisma.poll.create({
    data: {
      title: 'What should be our top infrastructure priority?',
      description: 'Help us decide where to focus our infrastructure budget for the coming year.',
      creatorId: users[1].id,
      closesAt: new Date('2026-07-31'),
    },
  });
  await Promise.all([
    prisma.pollOption.create({ data: { pollId: poll.id, text: 'Road Repairs & Potholes', votes: 156 } }),
    prisma.pollOption.create({ data: { pollId: poll.id, text: 'Bridge Maintenance', votes: 89 } }),
    prisma.pollOption.create({ data: { pollId: poll.id, text: 'Water System Upgrades', votes: 203 } }),
    prisma.pollOption.create({ data: { pollId: poll.id, text: 'Pedestrian Safety Improvements', votes: 134 } }),
  ]);

  // Create surveys
  const survey = await prisma.survey.create({
    data: {
      title: 'Community Services Satisfaction Survey',
      description: 'Help us improve municipal services by sharing your feedback.',
      creatorId: users[1].id,
      closesAt: new Date('2026-08-31'),
      questions: {
        create: [
          { text: 'How satisfied are you with city services overall?', type: 'RATING', order: 1 },
          { text: 'Which service needs the most improvement?', type: 'MULTIPLE_CHOICE', options: ['Roads', 'Parks', 'Sanitation', 'Public Safety'], order: 2 },
          { text: 'Additional comments', type: 'TEXT', order: 3 },
        ],
      },
    },
  });
  console.log('  ✅ Survey created:', survey.title);

  // Create forums
  const forum = await prisma.forum.create({
    data: {
      title: 'Downtown Revitalization Plan',
      description: 'Share your thoughts on the proposed downtown development initiative.',
      creatorId: users[4].id,
    },
  });
  await Promise.all([
    prisma.forumPost.create({ data: { forumId: forum.id, authorId: users[10].id, content: 'I support more green spaces in the downtown area. Parks would make it more family-friendly.' } }),
    prisma.forumPost.create({ data: { forumId: forum.id, authorId: users[11].id, content: 'We need better pedestrian crossings on Main Street before any new development starts.' } }),
    prisma.forumPost.create({ data: { forumId: forum.id, authorId: users[2].id, content: 'Public Works is ready to coordinate infrastructure upgrades with the development timeline.' } }),
  ]);
  console.log('  ✅ Forum created:', forum.title);

  // Sample audit logs
  await Promise.all([
    prisma.auditLog.create({ data: { userId: users[7].id, action: 'UPDATE_STATUS', entity: 'Issue', entityId: issues[0].id, oldValues: { status: 'ACKNOWLEDGED' }, newValues: { status: 'IN_PROGRESS' } } }),
    prisma.auditLog.create({ data: { userId: users[0].id, action: 'ASSIGN', entity: 'Issue', entityId: issues[1].id, newValues: { assigneeId: users[7].id } } }),
    prisma.auditLog.create({ data: { userId: users[10].id, action: 'CREATE', entity: 'Issue', entityId: issues[4].id, newValues: { title: issues[4].title } } }),
  ]);

  console.log('✅ Seeding complete!');
  console.log(`   ${departments.length} departments`);
  console.log(`   ${wards.length} wards`);
  console.log(`   ${users.length} users`);
  console.log(`   ${issues.length} issues`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
