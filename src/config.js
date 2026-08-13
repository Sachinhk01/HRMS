export const ROLES = {
  EMPLOYEE: 'EMPLOYEE',
  HR_ADMIN: 'HR_ADMIN',
  MANAGER: 'MANAGER',
  SUPER_ADMIN: 'SUPER_ADMIN',
  PAYROLL_ADMIN: 'PAYROLL_ADMIN',
  CLIENT: 'CLIENT',
};


export const ROLE_MENUS = {
  EMPLOYEE: [
    ['/dashboard', 'Dashboard'],
    ['/attendance', 'Attendance'],
    ['/leave', 'Leave'],
    ['/celebrations', 'Celebration Wall'],
    ['/profile', 'Profile'],
  ],

  HR_ADMIN: [
    ['/dashboard', 'Dashboard'],
    ['/employees', 'Employees'],
    ['/attendance', 'Attendance'],
    ['/celebrations', 'Celebration Wall'],
    ['/announcements', 'Announcements'],
    ['/events', 'Events'],
    ['/reports', 'Reports'],
    ['/profile', 'Profile'],
  ],

  MANAGER: [
    ['/dashboard', 'Dashboard'],
    ['/leave', 'My Leave'],
    ['/leave-approvals', 'Leave Approvals'],
    ['/attendance', 'Attendance'],
    ['/celebrations', 'Celebration Wall'],
    ['/performance', 'Performance'],
    ['/employees', 'Employees'],
    ['/profile', 'Profile'],
  ],

  SUPER_ADMIN: [
    ['/dashboard', 'Dashboard'],
    ['/employees', 'Employees'],
    ['/attendance', 'Attendance'],
    ['/celebrations', 'Celebration Wall'],
    ['/announcements', 'Announcements'],
    ['/events', 'Events'],
    ['/reports', 'Reports'],
    ['/leave', 'Leave'],
    ['/leave-approvals', 'Leave Approvals'],
    ['/performance', 'Performance'],
    ['/candidates', 'Candidates'],
    ['/profile', 'Profile'],
  ],

  PAYROLL_ADMIN: [
    ['/dashboard', 'Dashboard'],
    ['/profile', 'Profile'],
  ],

  CLIENT: [
    ['/dashboard', 'Dashboard'],
    ['/profile', 'Profile'],
  ],
};

export const ROUTE_ROLES = {
  '/dashboard': [
    'EMPLOYEE',
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
    'PAYROLL_ADMIN',
    'CLIENT',
  ],

  '/attendance': [
    'EMPLOYEE',
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
  ],

  '/profile': [
    'EMPLOYEE',
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
    'PAYROLL_ADMIN',
    'CLIENT',
  ],

  '/leave': [
    'EMPLOYEE',
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
  ],

  '/celebrations': [
    'EMPLOYEE',
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
  ],

  '/employees': [
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
  ],

  '/announcements': [
    'HR_ADMIN',
    'SUPER_ADMIN',
    'EMPLOYEE'
  ],

  '/events': [
    'HR_ADMIN',
    'SUPER_ADMIN',
    'EMPLOYEE'
  ],

  '/reports': [
    'HR_ADMIN',
    'SUPER_ADMIN',
  ],

  '/leave-approvals': [
    'MANAGER',
    'SUPER_ADMIN',
  ],
  '/notifications': [
  'EMPLOYEE',
  'HR_ADMIN',
  'MANAGER',
  'SUPER_ADMIN',
  'PAYROLL_ADMIN',
  'CLIENT',
],




  '/performance': [
    'MANAGER',
    'SUPER_ADMIN',
  ],
  '/holidays': ['EMPLOYEE', 'HR_ADMIN', 'MANAGER', 'SUPER_ADMIN'],
  '/candidates': [
    'MANAGER',
    'SUPER_ADMIN',
  ],
};