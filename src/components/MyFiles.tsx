import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  FolderPlus, 
  Plus, 
  MoreVertical, 
  Folder as FolderIcon,
  Search,
  Loader2,
  HardDrive,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  serverTimestamp, 
  deleteDoc, 
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { useWorkspace } from '../lib/WorkspaceContext';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

interface Folder {
  id: string;
  name: string;
  createdAt: any;
}

interface FileMetadata {
  id: string;
  name: string;
  folderId?: string;
  size: string;
  type: string;
  storagePath: string;
  downloadURL: string;
  createdAt: any;
}

export default function MyFiles() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storageUsage, setStorageUsage] = useState(85); // 85%
  const [showBilling, setShowBilling] = useState(false);
  const [showUpgradeLimitModal, setShowUpgradeLimitModal] = useState(false);
  const [isLinkingCloud, setIsLinkingCloud] = useState(false);
  const [userPlan, setUserPlan] = useState('Starter');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const user = auth.currentUser;
  const { workspaceUid } = useWorkspace();
  const isLimitReached = userPlan === 'Starter' && files.length >= 5;

  useEffect(() => {
    if (!user) return;

    const uid = user.uid;

    // Load initial user state (Plan)
    const loadUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserPlan(data.plan || 'Starter');
        } else {
          // Initialize profile if non-existent
          await setDoc(doc(db, 'users', uid), {
            email: user.email,
            createdAt: serverTimestamp(),
            plan: 'Starter'
          });
          setUserPlan('Starter');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      }
    };

    loadUser();

    const foldersQuery = query(collection(db, 'users', uid, 'folders'));
    const filesQuery = query(collection(db, 'users', uid, 'files'));

    const unsubFolders = onSnapshot(foldersQuery, (snapshot) => {
      const folderList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Folder));
      setFolders(folderList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}/folders`);
    });

    const unsubFiles = onSnapshot(filesQuery, (snapshot) => {
      const fileList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileMetadata));
      setFiles(fileList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}/files`);
    });

    return () => {
      unsubFolders();
      unsubFiles();
    };
  }, [user]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newFolderName.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'folders'), {
        name: newFolderName.trim(),
        createdAt: serverTimestamp()
      });
      setNewFolderName('');
      setShowFolderModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/folders`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFile || isLimitReached) return;

    setIsSubmitting(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const uid = user.uid;
      // Get a new Firestore doc reference to get a unique ID before upload
      const fileRef = doc(collection(db, 'users', uid, 'files'));
      const fileId = fileRef.id;
      
      const storagePath = `user_uploads/${uid}/${fileId}-${selectedFile.name}`;
      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          setUploadError(error.message);
          setIsSubmitting(false);
          setUploadProgress(null);
        }, 
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            await setDoc(fileRef, {
              name: selectedFile.name,
              size: formatFileSize(selectedFile.size),
              type: selectedFile.type,
              storagePath: storagePath,
              downloadURL: downloadURL,
              folderId: selectedFolderId || null,
              createdAt: serverTimestamp()
            });

            setSelectedFile(null);
            setUploadProgress(null);
            setSelectedFolderId('');
            setShowFileModal(false);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${uid}/files/${fileId}`);
          } finally {
            setIsSubmitting(false);
          }
        }
      );
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Unknown error');
      setIsSubmitting(false);
    }
  };

  const handleDeleteFile = async (id: string, storagePath: string) => {
    if (!user) return;
    try {
      // Delete from storage first
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);

      // Delete from firestore
      await deleteDoc(doc(db, 'users', user.uid, 'files', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/files/${id}`);
    }
  };

  const handleDownload = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCloudLinkPayment = async () => {
    if (!user) return;
    setIsLinkingCloud(true);
    try {
      // Persist the upgrade to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        plan: 'Enterprise',
        updatedAt: serverTimestamp()
      }, { merge: true });

      setStorageUsage(15);
      setUserPlan('Enterprise');
      setShowBilling(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setIsLinkingCloud(false);
    }
  };

  const storageUsagePercent = userPlan === 'Enterprise' ? 15 : Math.min(100, (files.length / 5) * 100);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            MY <span className="text-primary italic">FILES</span>
            <HardDrive className="w-8 h-8 text-slate-200" />
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em]">Cloud Storage • Operational Sandbox</p>
            {userPlan !== 'Enterprise' && (
              <div className="flex items-center gap-2 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full cursor-pointer hover:bg-amber-100 transition-all" onClick={() => setShowBilling(true)}>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">
                  {files.length >= 5 ? 'Quota Exceeded' : `Storage ${files.length}/5 Files`} ({Math.round(storageUsagePercent)}%) • Upgrade
                </span>
              </div>
            )}
            {userPlan === 'Enterprise' && (
              <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Enterprise Linked • 100 GB</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLimitReached && (
            <div className="flex items-center gap-3 mr-2">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">You've reached the free plan limit.</span>
              <button 
                onClick={() => setShowUpgradeLimitModal(true)}
                className="bg-amber-100 text-amber-600 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-amber-200 transition-all border border-amber-200 shadow-sm"
              >
                Upgrade Now
              </button>
            </div>
          )}
          <button 
            onClick={() => setShowFolderModal(true)}
            className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
          <button 
            disabled={isLimitReached}
            onClick={() => setShowFileModal(true)}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add File
          </button>
        </div>
      </div>

      <div className="erp-card p-6 border-none shadow-sm flex items-center gap-4">
        <Search className="w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search through archives..." 
          className="bg-transparent border-none outline-none flex-1 font-bold text-slate-600 text-sm placeholder:text-slate-300"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest">Querying Cloud Bricks...</p>
        </div>
      ) : (
        <div className="space-y-12">
          {folders.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <FolderIcon className="w-3 h-3" /> System Directories
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {folders.map(folder => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={folder.id} 
                    className="erp-card p-4 hover:bg-slate-50 transition-all cursor-pointer group"
                  >
                    <FolderIcon className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
                    <p className="text-xs font-black text-slate-800 truncate">{folder.name}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                      {files.filter(f => f.folderId === folder.id).length} Objects
                    </p>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <FileText className="w-3 h-3" /> Core Manifests
            </h3>
            {filteredFiles.length === 0 ? (
              <div className="erp-card p-20 text-center border-dashed border-2 border-slate-200">
                <FileText className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No active file clusters detected</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredFiles.map(file => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={file.id} 
                    className="erp-card p-4 border-none shadow-sm flex items-center justify-between group hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{file.name}</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                          <span>{file.size}</span>
                          <span>•</span>
                          <span>{file.type || 'Unknown Type'}</span>
                          <span>•</span>
                          <span>{folders.find(f => f.id === file.folderId)?.name || 'Root'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleDownload(file.downloadURL)}
                        className="p-2 text-slate-400 hover:text-primary transition-colors"
                        title="Download"
                      >
                        <Plus className="w-5 h-5 rotate-45" />
                      </button>
                      <button 
                        onClick={() => handleDeleteFile(file.id, file.storagePath)}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                        title="Delete"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFolderModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white">
                  <FolderPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase">CREATE DIRECTORY</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Logical Cluster</p>
                </div>
              </div>

              <form onSubmit={handleCreateFolder} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Directory Name</label>
                  <input 
                    autoFocus
                    required
                    type="text" 
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none focus:border-primary transition-all"
                    placeholder="e.g. Sales Reports 2024"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowFolderModal(false)}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                  >
                    Abort
                  </button>
                  <button 
                    disabled={isSubmitting}
                    className="flex-[2] bg-slate-900 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Processing...' : 'Generate Directory'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showFileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFileModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase">UPLOAD FILE</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cloud Storage Segment</p>
                </div>
              </div>

              <form onSubmit={handleUploadFile} className="space-y-6">
                <div className="space-y-4">
                  <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary transition-all group"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                      <Plus className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                        {selectedFile ? selectedFile.name : 'Choose operational document'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                        {selectedFile ? formatFileSize(selectedFile.size) : 'Drag and drop or click to browse'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Assign Directory</label>
                    <select 
                      value={selectedFolderId}
                      onChange={(e) => setSelectedFolderId(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none focus:border-primary transition-all"
                    >
                      <option value="">Root Cluster</option>
                      {folders.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {uploadProgress !== null && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[8px] font-black uppercase text-slate-400">
                      <span>Transmission Progress</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-bold text-rose-600 uppercase">
                    Error: {uploadError}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setShowFileModal(false);
                      setSelectedFile(null);
                      setUploadProgress(null);
                      setUploadError(null);
                    }}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 disabled:opacity-50"
                  >
                    Abort
                  </button>
                  <button 
                    disabled={isSubmitting || !selectedFile}
                    className="flex-[2] bg-slate-900 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Transmitting...
                      </>
                    ) : 'Initiate Upload'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cloud Link Payment Modal */}
      <AnimatePresence>
        {showBilling && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBilling(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a184d] rounded-[32px] w-full max-w-md p-8 shadow-2xl relative z-10 overflow-hidden text-white"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Cloud Link Payment</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Storage Expansion Module</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Usage Assessment</span>
                    <span>8.5 GB / 10 GB</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 w-[85%]" />
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    You have reached the operational limit of your current cloud segment. Expansion is required to maintain synchronization.
                  </p>
                </div>

                <div className="p-4 bg-primary rounded-2xl border border-white/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Enterprise Tier Upgrade</p>
                      <p className="text-xl font-black italic">Rs. 2,500 <span className="text-[10px] font-normal opacity-50">/ Year</span></p>
                    </div>
                    <div className="bg-white/20 px-3 py-1 rounded-full text-[8px] font-bold uppercase">100 GB Link</div>
                  </div>
                </div>

                <button 
                  onClick={handleCloudLinkPayment}
                  disabled={isLinkingCloud}
                  className="w-full bg-amber-500 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-amber-600 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isLinkingCloud ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Establish Cloud Link Payment</>
                  )}
                </button>
                
                <button 
                  onClick={() => setShowBilling(false)}
                  className="w-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-400 transition-colors"
                >
                  Postpone Authorization
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Upgrade Limit Modal */}
      <AnimatePresence>
        {showUpgradeLimitModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUpgradeLimitModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl relative z-10 text-center"
            >
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase mb-4 tracking-tight">Upgrade your plan</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-8">
                Your current free segment has reached its asset capacity. Upgrade to Enterprise for unlimited storage and advanced synchronization.
              </p>
              <button 
                onClick={() => setShowUpgradeLimitModal(false)}
                className="w-full bg-slate-900 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"
              >
                Understood, Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
