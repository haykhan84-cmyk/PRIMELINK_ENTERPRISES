import React, { useState, useEffect } from 'react';
import { 
  StickyNote, 
  Plus, 
  Search,
  Loader2,
  Trash2,
  Edit3,
  Book
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
  orderBy 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useWorkspace } from '../lib/WorkspaceContext';
import { formatDate } from '../lib/dateUtils';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: any;
}

export default function MyNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const user = auth.currentUser;
  const { workspaceUid } = useWorkspace();

  useEffect(() => {
    if (!user || !workspaceUid) return;

    const notesQuery = query(
      collection(db, 'users', workspaceUid, 'notes'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
      const noteList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      setNotes(noteList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${workspaceUid}/notes`);
    });

    return () => unsubscribe();
  }, [user, workspaceUid]);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !workspaceUid || !newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'users', workspaceUid, 'notes'), {
        title: newTitle.trim(),
        content: newContent.trim(),
        createdAt: serverTimestamp()
      });
      setNewTitle('');
      setNewContent('');
      setShowNoteModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${workspaceUid}/notes`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!user || !workspaceUid) return;
    try {
      await deleteDoc(doc(db, 'users', workspaceUid, 'notes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${workspaceUid}/notes/${id}`);
    }
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            MY <span className="text-primary italic">NOTES</span>
            <Book className="w-8 h-8 text-slate-200" />
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1">Personnel Observations • Brain Dump</p>
        </div>
        <button 
          onClick={() => setShowNoteModal(true)}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl active:scale-95"
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      <div className="erp-card p-6 border-none shadow-sm flex items-center gap-4">
        <Search className="w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Filter your thoughts..." 
          className="bg-transparent border-none outline-none flex-1 font-bold text-slate-600 text-sm placeholder:text-slate-300"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest">Retrieving Neural Logs...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.length === 0 ? (
            <div className="col-span-full erp-card p-20 text-center border-dashed border-2 border-slate-200">
              <StickyNote className="w-12 h-12 text-slate-100 mx-auto mb-4" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No active thoughts recorded</p>
            </div>
          ) : (
            filteredNotes.map(note => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                key={note.id}
                className="erp-card p-6 border-none shadow-sm flex flex-col justify-between hover:shadow-md transition-all group min-h-[200px]"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                      <StickyNote className="w-4 h-4" />
                    </div>
                    <button 
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 px-2 text-[8px] font-black uppercase tracking-widest text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      Purge
                    </button>
                  </div>
                  <h3 className="text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">{note.title}</h3>
                  <p className="text-xs font-bold text-slate-500 leading-relaxed line-clamp-4 italic">
                    {note.content || 'No description added...'}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                    {note.createdAt ? formatDate(note.createdAt.toDate()) : 'Just now'}
                  </span>
                  <Edit3 className="w-3 h-3 text-slate-200" />
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Note Modal */}
      <AnimatePresence>
        {showNoteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNoteModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white">
                  <StickyNote className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">ENGRAVE NOTE</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thought Synchronization</p>
                </div>
              </div>

              <form onSubmit={handleCreateNote} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Note Heading</label>
                  <input 
                    autoFocus
                    required
                    type="text" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none focus:border-amber-500 transition-all"
                    placeholder="e.g. Critical Supplier Update"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Conceptual Content</label>
                  <textarea 
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none focus:border-amber-500 transition-all resize-none"
                    placeholder="Describe your thinking..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowNoteModal(false)}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                  >
                    Discard
                  </button>
                  <button 
                    disabled={isSubmitting}
                    className="flex-[2] bg-slate-900 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Syncing...' : 'Engrave Thought'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
