// backend/scripts/seed-staff.js
import mongoose from 'mongoose';
import StaffModel from '../models/staff.model.js';
import dotenv from 'dotenv';

dotenv.config();

const staffData = [
  {
    fullName: 'Ramesh Kumar',
    role: 'PLUMBER',
    phone: '+91 9876543210',
    email: 'ramesh@hostel.com',
    expertiseCategories: ['PLUMBING', 'MAINTENANCE'],
    assignedHostels: [], // Fill with actual IDs
    currentWorkload: 0,
    avgResolutionTime: 18.5,
    satisfactionScore: 4.6,
    isActive: true,
  },
  {
    fullName: 'Suresh Yadav',
    role: 'ELECTRICIAN',
    phone: '+91 9876543211',
    email: 'suresh@hostel.com',
    expertiseCategories: ['ELECTRICAL'],
    assignedHostels: [],
    currentWorkload: 2,
    avgResolutionTime: 24.2,
    satisfactionScore: 4.3,
    isActive: true,
  },
  {
    fullName: 'Prakash Singh',
    role: 'IT_SUPPORT',
    phone: '+91 9876543212',
    email: 'prakash@hostel.com',
    expertiseCategories: ['INTERNET'],
    assignedHostels: [],
    currentWorkload: 1,
    avgResolutionTime: 12.8,
    satisfactionScore: 4.8,
    isActive: true,
  },
  {
    fullName: 'Deepak Verma',
    role: 'CLEANER',
    phone: '+91 9876543213',
    email: 'deepak@hostel.com',
    expertiseCategories: ['CLEANLINESS'],
    assignedHostels: [],
    currentWorkload: 0,
    avgResolutionTime: 8.5,
    satisfactionScore: 4.5,
    isActive: true,
  },
  {
    fullName: 'Vikram Sharma',
    role: 'GENERAL_MAINTENANCE',
    phone: '+91 9876543214',
    email: 'vikram@hostel.com',
    expertiseCategories: ['MAINTENANCE', 'FURNITURE', 'OTHER'],
    assignedHostels: [],
    currentWorkload: 3,
    avgResolutionTime: 36.4,
    satisfactionScore: 4.1,
    isActive: true,
  },
];

async function seedStaff() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await StaffModel.deleteMany({});
    console.log('Cleared existing staff');

    const staff = await StaffModel.insertMany(staffData);
    console.log(`✅ Created ${staff.length} staff members`);

    console.log('\nStaff List:');
    staff.forEach(s => {
      console.log(`- ${s.fullName} (${s.role}): ${s.expertiseCategories.join(', ')}`);
    });

    mongoose.disconnect();
  } catch (error) {
    console.error('Seed error:', error);
    mongoose.disconnect();
  }
}

seedStaff();