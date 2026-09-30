'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAuditLog } from '@/lib/audit/create-audit-log'

// ============================================================
// Validation Schemas
// ============================================================

const RegisterSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

// ============================================================
// Action Result Type
// ============================================================

export type ActionResult<T = undefined> =
  | { success: true; data?: T; message?: string }
  | { success: false; error: string; field?: string }

// ============================================================
// REGISTER
// ============================================================

export async function registerAction(
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    fullName: formData.get('fullName') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const result = RegisterSchema.safeParse(rawData)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return {
      success: false,
      error: firstError.message,
      field: firstError.path[0] as string,
    }
  }

  const { fullName, email, password } = result.data

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { success: false, error: 'An account with this email already exists.', field: 'email' }
    }
    return { success: false, error: error.message }
  }

  if (data.user) {
    await createAuditLog({
      userId: data.user.id,
      action: 'create',
      module: 'auth',
      recordType: 'user',
      recordId: data.user.id,
      newValues: { email, fullName },
    })
  }

  revalidatePath('/', 'layout')
  redirect('/onboarding')
}

// ============================================================
// LOGIN
// ============================================================

export async function loginAction(
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const result = LoginSchema.safeParse(rawData)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return {
      success: false,
      error: firstError.message,
      field: firstError.path[0] as string,
    }
  }

  const { email, password } = result.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { success: false, error: 'Invalid email or password.' }
    }
    return { success: false, error: error.message }
  }

  if (data.user) {
    await createAuditLog({
      userId: data.user.id,
      action: 'login',
      module: 'auth',
      recordType: 'user',
      recordId: data.user.id,
    })
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ============================================================
// LOGOUT
// ============================================================

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  await supabase.auth.signOut()

  if (user) {
    await createAuditLog({
      userId: user.id,
      action: 'logout',
      module: 'auth',
      recordType: 'user',
      recordId: user.id,
    })
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}

// ============================================================
// FORGOT PASSWORD
// ============================================================

export async function forgotPasswordAction(
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get('email') as string

  if (!email || !z.string().email().safeParse(email).success) {
    return { success: false, error: 'Please enter a valid email address.', field: 'email' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Always return success to prevent email enumeration
  return {
    success: true,
    message: 'If an account exists with that email, you will receive a reset link.',
  }
}
