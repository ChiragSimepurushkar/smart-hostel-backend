// src/utils/seed.js
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db.js';

// Import models
import User from '../models/user.model.js';
import Hostel from '../models/hostel.model.js';
import Block from '../models/block.model.js';
import Issue from '../models/issue.model.js';
import IssueStatusHistory from '../models/issueStatusHistory.model.js';
import Staff from '../models/staff.model.js';
import Announcement from '../models/announcement.model.js';

async function seed() {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Connect to database
    await connectDB();

    // Clear existing data (DEVELOPMENT ONLY!)
    if (process.env.NODE_ENV === 'development') {
      console.log('🗑️  Clearing existing data...');
      await User.deleteMany({});
      await Hostel.deleteMany({});
      await Block.deleteMany({});
      await Issue.deleteMany({});
      await IssueStatusHistory.deleteMany({});
      await Staff.deleteMany({});
      await Announcement.deleteMany({});
      console.log('✅ Existing data cleared\n');
    }

    // Create Hostels
    console.log('🏢 Creating hostels...');
    const hostelA = await Hostel.create({
      name: 'Hostel A',
      location: 'North Campus',
      totalBlocks: 3,
      capacity: 300,
    });

    const hostelB = await Hostel.create({
      name: 'Hostel B',
      location: 'South Campus',
      totalBlocks: 2,
      capacity: 200,
    });
    console.log('✅ Hostels created\n');

    // Create Blocks
    console.log('🏗️  Creating blocks...');
    const blockA1 = await Block.create({
      name: 'Block 1',
      hostel: hostelA._id,
      floorCount: 4,
    });

    const blockA2 = await Block.create({
      name: 'Block 2',
      hostel: hostelA._id,
      floorCount: 4,
    });

    const blockB1 = await Block.create({
      name: 'Block 1',
      hostel: hostelB._id,
      floorCount: 3,
    });
    console.log('✅ Blocks created\n');

    // Create Users
    console.log('👥 Creating users...');
    const hashedPassword = await bcrypt.hash('password123', 10);

    const admin = await User.create({
      email: 'admin@smartward.com',
      password: hashedPassword,
      fullName: 'Admin User',
      role: 'ADMIN',
      isVerified: true,
      isActive: true,
    });

    const management = await User.create({
      email: 'warden@smartward.com',
      password: hashedPassword,
      fullName: 'Hostel Warden',
      role: 'MANAGEMENT',
      hostel: hostelA._id,
      isVerified: true,
      isActive: true,
    });

    const student1 = await User.create({
      email: 'john@student.com',
      phone: '9876543210',
      password: hashedPassword,
      fullName: 'John Doe',
      role: 'STUDENT',
      department: 'Computer Science',
      year: '3rd Year',
      hostel: hostelA._id,
      block: blockA1._id,
      roomNumber: '201',
      isVerified: true,
      isActive: true,
    });

    const student2 = await User.create({
      email: 'jane@student.com',
      phone: '9876543211',
      password: hashedPassword,
      fullName: 'Jane Smith',
      role: 'STUDENT',
      department: 'Electronics',
      year: '2nd Year',
      hostel: hostelA._id,
      block: blockA2._id,
      roomNumber: '305',
      isVerified: true,
      isActive: true,
    });
    console.log('✅ Users created\n');

    // Create Staff
    console.log('👷 Creating staff...');
    const plumber = await Staff.create({
      fullName: 'Ramesh Kumar',
      role: 'Plumber',
      phone: '9123456780',
      email: 'ramesh@smartward.com',
      specialization: ['Water pipes', 'Drainage', 'Taps'],
      assignedHostelIds: [hostelA._id],
      assignedBlockIds: [blockA1._id, blockA2._id],
      isActive: true,
    });

    const electrician = await Staff.create({
      fullName: 'Suresh Yadav',
      role: 'Electrician',
      phone: '9123456781',
      email: 'suresh@smartward.com',
      specialization: ['Wiring', 'Switches', 'Lights'],
      assignedHostelIds: [hostelA._id, hostelB._id],
      isActive: true,
    });
    console.log('✅ Staff created\n');

    // Create Sample Issues
    console.log('📋 Creating sample issues...');
    const issue1 = await Issue.create({
      title: 'Water leaking from bathroom tap',
      description: 'The tap in my bathroom has been leaking continuously for 2 days. Water is being wasted.',
      category: 'PLUMBING',
      priority: 'MEDIUM',
      status: 'ASSIGNED',
      isPublic: true,
      hostel: hostelA._id,
      block: blockA1._id,
      roomNumber: '201',
      reporter: student1._id,
      assignedTo: plumber._id,
      assignedAt: new Date(),
      aiCategory: 'PLUMBING',
      aiPriority: 'MEDIUM',
      aiConfidence: 0.95,
    });

    await IssueStatusHistory.create([
      {
        issue: issue1._id,
        status: 'REPORTED',
        updatedBy: student1._id,
        remarks: 'Issue reported',
      },
      {
        issue: issue1._id,
        status: 'ASSIGNED',
        updatedBy: management._id,
        remarks: 'Assigned to Ramesh Kumar',
      },
    ]);

    const issue2 = await Issue.create({
      title: 'No power in room',
      description: 'There is no electricity in my room since this morning. All switches are not working.',
      category: 'ELECTRICAL',
      priority: 'HIGH',
      status: 'REPORTED',
      isPublic: true,
      hostel: hostelA._id,
      block: blockA2._id,
      roomNumber: '305',
      reporter: student2._id,
      aiCategory: 'ELECTRICAL',
      aiPriority: 'HIGH',
      aiConfidence: 0.92,
    });

    await IssueStatusHistory.create({
      issue: issue2._id,
      status: 'REPORTED',
      updatedBy: student2._id,
      remarks: 'Issue reported',
    });
    console.log('✅ Sample issues created\n');

    // Create Announcement
    console.log('📢 Creating announcements...');
    await Announcement.create({
      title: 'Water Supply Maintenance',
      content: '<p>Water supply will be disrupted tomorrow from 10 AM to 2 PM for tank cleaning.</p>',
      category: 'MAINTENANCE',
      hostelIds: [hostelA._id],
      blockIds: [],
      targetRole: null,
      createdBy: management._id,
      isPinned: true,
      isActive: true,
    });
    console.log('✅ Announcements created\n');

    console.log('🎉 Seeding completed successfully!\n');
    console.log('📝 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:      admin@smartward.com / password123');
    console.log('Management: warden@smartward.com / password123');
    console.log('Student 1:  john@student.com / password123');
    console.log('Student 2:  jane@student.com / password123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

// Run seed
seed();