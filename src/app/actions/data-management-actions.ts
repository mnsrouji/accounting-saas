'use server'

import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { DataManagementService, PurgeType, BackupPayload } from '@/lib/services/data-management-service'
import { revalidatePath } from 'next/cache'

export async function getBackupStatsAction(businessId: string) {
  try {
    await requireBusinessAccess(businessId)
    const stats = await DataManagementService.getBusinessDataStats(businessId)
    return { success: true, stats }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function validateBackupAction(backupJsonString: string) {
  try {
    const parsed = JSON.parse(backupJsonString)
    const validation = DataManagementService.validateBackup(parsed)
    return { success: true, validation }
  } catch (error: any) {
    return { success: false, error: 'JSON parsing failed: ' + error.message }
  }
}

export async function restoreBackupAction(
  businessId: string,
  backupJsonString: string,
  mode: 'overwrite' | 'merge'
) {
  try {
    await requireBusinessAccess(businessId)
    const parsed: BackupPayload = JSON.parse(backupJsonString)
    const result = await DataManagementService.restoreBusinessBackup(businessId, parsed, mode)
    
    revalidatePath(`/b/${businessId}`, 'layout')
    return { success: true, result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function purgeDataAction(
  businessId: string,
  purgeType: PurgeType,
  confirmPhrase: string
) {
  try {
    await requireBusinessAccess(businessId)
    const result = await DataManagementService.purgeBusinessData(businessId, purgeType, confirmPhrase)
    
    revalidatePath(`/b/${businessId}`, 'layout')
    return { success: true, result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
