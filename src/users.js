// Private user configuration file
// This file should not be committed to version control
// Add this file to .gitignore

export const users = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123', // In production, use hashed passwords
    role: 'admin',
    name: 'Administrator'
  },
  {
    id: 2,
    username: 'user1',
    password: 'user123',
    role: 'user',
    name: 'Regular User'
  },
  {
    id: 3,
    username: 'analyst',
    password: 'analyst123',
    role: 'analyst',
    name: 'Financial Analyst'
  },
  {
    id: 4,
    username: 'entrust001',
    password: '2tTokhjidE',
    role: 'user',
    name: 'Entrust User 001'
  },
  {
    id: 5,
    username: 'entrust002',
    password: 'ebR0REdj3f',
    role: 'user',
    name: 'Entrust User 002'
  },
  {
    id: 6,
    username: 'entrust003',
    password: 'vu7UrMEG4v',
    role: 'user',
    name: 'Entrust User 003'
  },
  {
    id: 7,
    username: 'ubot001',
    password: 'CgBy4ew0na',
    role: 'user',
    name: 'UBot User 001'
  },
  {
    id: 8,
    username: 'ubot002',
    password: 'DfxgRK15tL',
    role: 'user',
    name: 'UBot User 002'
  },
  {
    id: 9,
    username: 'ubot003',
    password: '3eZM5tEU6J',
    role: 'user',
    name: 'UBot User 003'
  }
];

// Helper function to find user by credentials
export const findUserByCredentials = (username, password) => {
  return users.find(user => 
    user.username === username && user.password === password
  );
};

// Helper function to find user by ID
export const findUserById = (id) => {
  return users.find(user => user.id === id);
};

