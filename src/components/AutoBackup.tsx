import { useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useWorkspace } from '../lib/WorkspaceContext';

export default function AutoBackup() {
  const { currentUserRole, workspaceUid } = useWorkspace();

  useEffect(() => {
    // Only the primary admin (boss) handles the auto-backups and inaugural syncs
    if (currentUserRole !== 'admin' || !workspaceUid) return;

    const performBackup = async () => {
      try {
        console.log("[AutoBackup] Initiating scheduled database snapshot...");
        
        // Connectivity check
        try {
          const healthCheck = await fetch('/api/health');
          console.log("[AutoBackup] API Health Check:", healthCheck.status, healthCheck.ok);
        } catch (e) {
          console.warn("[AutoBackup] API Health Check failed before backup:", e);
        }

        const res = await fetch('/api/backup/export');
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Server export failed: ${res.status} ${errorText}`);
        }
        
        const data = await res.json();
        
        // Safety check: Don't auto-overwrite if the database appears significantly empty 
        // compared to what a production system should have (at least some customers/orders)
        // especially if we just started (15s timeout)
        const totalRecords = Object.values(data).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
        const hasBackup = localStorage.getItem(`last_backup_${workspaceUid}`);
        
        // If we have a backup history but the current DB is basically empty (just seed data), 
        // skip this auto-backup to avoid pushing out good snapshots from the vault.
        const CUSTOMER_SEED_COUNT = 2; // Swat and Kalam
        if (hasBackup && data.customers?.length <= CUSTOMER_SEED_COUNT && data.orders?.length === 0) {
          console.warn("[AutoBackup] System appears reset. Skipping auto-snapshot to preserve cloud vault integrity.");
          return;
        }

        // Save to Firestore
        await addDoc(collection(db, 'users', workspaceUid, 'backups'), {
          userId: workspaceUid,
          data: JSON.stringify(data),
          createdAt: serverTimestamp(),
          count: Object.keys(data).reduce((acc: any, key: string) => {
            acc[key] = data[key].length;
            return acc;
          }, {})
        });
        
        console.log("[AutoBackup] Cloud snapshot successful. Database secured in Firestore.");
        
        // Store last backup time locally for UI
        localStorage.setItem(`last_backup_${workspaceUid}`, new Date().toISOString());
      } catch (err) {
        console.error("[AutoBackup] Failed to secure snapshot:", err);
      }
    };

    // INAUGURAL SYNC: Automatically recover the latest state from the vault on startup
    const inauguralSync = async () => {
      // Prevent infinite loops and multi-syncs in the same session
      if (sessionStorage.getItem(`sync_executed_${workspaceUid}`)) return;
      
      try {
        console.log("[SyncManager] Scanning cloud vault for latest continuity packet...");
        const backupsRef = collection(db, 'users', workspaceUid, 'backups');
        const q = query(backupsRef, orderBy('createdAt', 'desc'), limit(1));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          console.log("[SyncManager] Vault is empty. Continuity established.");
          sessionStorage.setItem(`sync_executed_${workspaceUid}`, 'true');
          return;
        }

        const latestBackup = snap.docs[0].data();
        const cloudCustomerCount = latestBackup.count?.customers || 0;

        // Check local state
        const rest = await fetch('/api/backup/export');
        const localData = await rest.json();
        const localCustomerCount = localData.customers?.length || 0;

        // If Cloud has more data (or specifically, more than the minimum seed records)
        // while local is empty/reset, we perform the auto-sync.
        if (cloudCustomerCount > localCustomerCount || (cloudCustomerCount > 2 && localCustomerCount <= 2)) {
          console.log(`[SyncManager] System drift detected. Cloud: ${cloudCustomerCount} vs Local: ${localCustomerCount}. Initiating auto-recovery...`);
          
          const importRes = await fetch('/api/backup/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: latestBackup.data
          });

          if (importRes.ok) {
            console.log("[SyncManager] Data re-instated. Hot-reloading terminal...");
            sessionStorage.setItem(`sync_executed_${workspaceUid}`, 'true');
            window.location.reload();
          }
        } else {
          console.log("[SyncManager] Local state is current or superior. Sync skipped.");
          sessionStorage.setItem(`sync_executed_${workspaceUid}`, 'true');
        }
      } catch (err) {
        console.error("[SyncManager] Inaugural sync failed:", err);
        // Still set the flag to avoid repeated failures blocking the UI
        sessionStorage.setItem(`sync_executed_${workspaceUid}`, 'true');
      }
    };

    // Run sync immediately on mount
    inauguralSync();

    // Run backup every 20 minutes (3 times an hour)
    const interval = setInterval(performBackup, 20 * 60 * 1000);
    
    // Initial delay of 30s for the first auto-backup (giving sync time to finish)
    const timeout = setTimeout(performBackup, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [currentUserRole, workspaceUid]);

  return null;
}
