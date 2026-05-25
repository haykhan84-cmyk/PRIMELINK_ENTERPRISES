import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface WorkspaceContextType {
  workspaceUid: string | null;
  setWorkspaceUid: (uid: string) => void;
  availableWorkspaces: Array<{ bossUid: string; bossEmail: string; role?: string }>;
  isSubordinate: boolean;
  currentUserRole: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceUid, setWorkspaceUid] = useState<string | null>(null);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Array<{ bossUid: string; bossEmail: string; role?: string }>>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const isSubordinate = availableWorkspaces.length > 0;

  useEffect(() => {
    let unsubscribeGrants: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setWorkspaceUid(user.uid);
        setCurrentUserRole('admin'); // Default role for boss
        
        // Listen for access grants where current user is a subordinate
        const email = user.email?.toLowerCase();
        if (email) {
          const grantsQuery = query(
            collection(db, 'access_grants'),
            where('subordinateEmail', '==', email)
          );

          unsubscribeGrants = onSnapshot(grantsQuery, (snapshot) => {
            const grants = snapshot.docs.map(doc => ({
              bossUid: doc.data().bossUid,
              bossEmail: doc.data().bossEmail,
              role: doc.data().role || 'staff'
            }));
            
            setAvailableWorkspaces(grants);
            console.log(`[Workspace] Found ${grants.length} authority domains for ${email}`);

            // If we are viewing a specific workspace, update role
            // We'll handle this in the setWorkspaceUid logic or here
          }, (error) => {
            if (error.code !== 'cancelled') {
              handleFirestoreError(error, OperationType.LIST, 'access_grants');
            }
          });
        }
      } else {
        setWorkspaceUid(null);
        setAvailableWorkspaces([]);
        setCurrentUserRole(null);
        if (unsubscribeGrants) {
          unsubscribeGrants();
          unsubscribeGrants = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeGrants) unsubscribeGrants();
    };
  }, []);

  // Update role when switching workspaces
  useEffect(() => {
    if (!auth.currentUser) return;
    
    if (workspaceUid === auth.currentUser.uid) {
      setCurrentUserRole('admin');
    } else {
      const activeGrant = availableWorkspaces.find(g => g.bossUid === workspaceUid);
      if (activeGrant) {
        setCurrentUserRole(activeGrant.role || 'staff');
      }
    }
  }, [workspaceUid, availableWorkspaces]);

  return (
    <WorkspaceContext.Provider value={{ 
      workspaceUid, 
      setWorkspaceUid, 
      availableWorkspaces,
      isSubordinate,
      currentUserRole
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
