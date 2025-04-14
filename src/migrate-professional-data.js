require('dotenv').config();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Import models
const Professional = require('./models/professional.model');
const ProfessionalDocument = require('./models/professional-document.model');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://root:root@cluster0.p9mt5.mongodb.net/')
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function migrateData() {
  console.log('Starting professional data migration...');
  
  try {
    // 1. Find all professionals
    const professionals = await Professional.find();
    console.log(`Found ${professionals.length} professional records`);
    
    // 2. Group professionals by email/phone to find duplicates
    const professionalsByEmail = {};
    const professionalsByPhone = {};
    
    professionals.forEach(prof => {
      if (prof.email) {
        if (!professionalsByEmail[prof.email]) {
          professionalsByEmail[prof.email] = [];
        }
        professionalsByEmail[prof.email].push(prof);
      }
      
      if (prof.phone) {
        if (!professionalsByPhone[prof.phone]) {
          professionalsByPhone[prof.phone] = [];
        }
        professionalsByPhone[prof.phone].push(prof);
      }
    });
    
    // 3. Find duplicate records
    const duplicates = [];
    for (const email in professionalsByEmail) {
      if (professionalsByEmail[email].length > 1) {
        duplicates.push({
          email,
          records: professionalsByEmail[email]
        });
      }
    }
    
    for (const phone in professionalsByPhone) {
      // Skip if already found by email
      if (professionalsByPhone[phone].length > 1 && 
          !duplicates.some(d => d.records.some(r => r.phone === phone))) {
        duplicates.push({
          phone,
          records: professionalsByPhone[phone]
        });
      }
    }
    
    console.log(`Found ${duplicates.length} duplicate professional sets`);
    
    // 4. Merge duplicates
    for (const duplicate of duplicates) {
      console.log(`Processing duplicate set: ${duplicate.email || duplicate.phone}`);
      
      // Sort records by completeness (more fields = more complete)
      const records = duplicate.records.sort((a, b) => {
        const aFields = Object.keys(a.toObject()).length;
        const bFields = Object.keys(b.toObject()).length;
        return bFields - aFields; // descending order
      });
      
      // Primary record (most complete)
      const primaryRecord = records[0];
      console.log(`Primary record: ${primaryRecord._id} (${primaryRecord.name || 'Unnamed'})`);
      
      // Secondary records to be merged
      const secondaryRecords = records.slice(1);
      
      for (const secondaryRecord of secondaryRecords) {
        console.log(`Merging: ${secondaryRecord._id} into ${primaryRecord._id}`);
        
        // Merge fields that exist in secondary but not in primary
        const secondaryObj = secondaryRecord.toObject();
        for (const key in secondaryObj) {
          // Skip _id, timestamps and duplicated keys
          if (['_id', 'createdAt', 'updatedAt', '__v'].includes(key)) continue;
          
          // Only copy if primary doesn't have this field or it's empty
          if (!primaryRecord[key] || 
              (Array.isArray(primaryRecord[key]) && primaryRecord[key].length === 0) ||
              (typeof primaryRecord[key] === 'string' && primaryRecord[key] === '')) {
            primaryRecord[key] = secondaryObj[key];
          }
        }
        
        // Special handling for documents
        if (secondaryRecord.documents && secondaryRecord.documents.length > 0) {
          // For each document in secondary record
          for (const doc of secondaryRecord.documents) {
            // Check if primary already has this document type
            const hasDocType = primaryRecord.documents.some(
              d => d.type === doc.type && d.status !== 'rejected'
            );
            
            // If primary doesn't have this doc type, or only has rejected ones, add it
            if (!hasDocType) {
              primaryRecord.documents.push(doc);
            }
          }
        }
        
        // Special handling for documentsStatus
        if (secondaryRecord.documentsStatus) {
          for (const docType in secondaryRecord.documentsStatus) {
            const secondaryStatus = secondaryRecord.documentsStatus[docType];
            const primaryStatus = primaryRecord.documentsStatus[docType];
            
            // Only update if secondary has better status
            const statusRank = {
              'not_submitted': 0,
              'rejected': 1,
              'pending': 2,
              'approved': 3
            };
            
            if (statusRank[secondaryStatus] > statusRank[primaryStatus]) {
              primaryRecord.documentsStatus[docType] = secondaryStatus;
            }
          }
        }
        
        // Fix references
        if (secondaryRecord.userId) {
          // If it's a valid ObjectId, we'll use it as externalId
          try {
            const objId = new ObjectId(secondaryRecord.userId);
            primaryRecord.externalId = secondaryRecord.userId;
          } catch (e) {
            // If it's not a valid ObjectId, it might be a custom ID like PRO92268334FQR
            primaryRecord.externalId = secondaryRecord.userId;
          }
        }
        
        // Save updated primary record
        await primaryRecord.save();
        
        // Migrate documents to new collection
        if (secondaryRecord.documents && secondaryRecord.documents.length > 0) {
          for (const doc of secondaryRecord.documents) {
            // Create new document in ProfessionalDocument collection
            const newDoc = new ProfessionalDocument({
              professionalId: primaryRecord._id,
              type: doc.type,
              fileUrl: doc.fileUrl,
              fileName: doc.fileName,
              mimeType: doc.mimeType,
              fileSize: doc.fileSize,
              uploadedAt: doc.uploadedAt,
              status: doc.status,
              verifiedBy: doc.verifiedBy,
              verifiedAt: doc.verifiedAt,
              remarks: doc.remarks
            });
            
            await newDoc.save();
          }
        }
        
        // Mark secondary for deletion
        await Professional.deleteOne({ _id: secondaryRecord._id });
      }
    }
    
    // 5. Migrate remaining professionals' documents to new collection
    console.log('Migrating remaining documents to new collection...');
    
    for (const professional of professionals) {
      // Skip if this was already handled as part of duplicate merging
      if (duplicates.some(d => d.records.some(r => r._id.equals(professional._id)))) {
        continue;
      }
      
      // Migrate documents
      if (professional.documents && professional.documents.length > 0) {
        for (const doc of professional.documents) {
          // Create new document in ProfessionalDocument collection
          const newDoc = new ProfessionalDocument({
            professionalId: professional._id,
            type: doc.type,
            fileUrl: doc.fileUrl,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            uploadedAt: doc.uploadedAt,
            status: doc.status,
            verifiedBy: doc.verifiedBy,
            verifiedAt: doc.verifiedAt,
            remarks: doc.remarks
          });
          
          await newDoc.save();
        }
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    mongoose.disconnect();
  }
}

migrateData();