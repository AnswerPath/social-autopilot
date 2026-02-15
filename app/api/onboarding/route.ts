import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getCurrentUser, createAuthError } from '@/lib/auth-utils'
import { AuthErrorType } from '@/lib/auth-types'
import { ONBOARDING_STEPS } from '@/lib/onboarding'

/**
 * GET /api/onboarding
 * Returns current user's onboarding progress.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
      { status: 401 }
    )
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('onboarding_step, onboarding_completed_at, tutorial_completed_at, show_contextual_tooltips')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Onboarding fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch onboarding progress' },
        { status: 500 }
      )
    }

    const step = profile?.onboarding_step ?? 0
    const completed = !!profile?.onboarding_completed_at
    const tutorialCompleted = !!profile?.tutorial_completed_at
    const showTooltips = profile?.show_contextual_tooltips ?? true

    return NextResponse.json({
      currentStep: step,
      completedSteps: completed
        ? Array.from({ length: ONBOARDING_STEPS.COMPLETE + 1 }, (_, i) => i)
        : Array.from({ length: step }, (_, i) => i),
      completedAt: profile?.onboarding_completed_at ?? null,
      tutorialCompletedAt: profile?.tutorial_completed_at ?? null,
      completed,
      tutorialCompleted,
      showContextualTooltips: showTooltips,
    })
  } catch (err) {
    console.error('Onboarding GET error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

const UpdateSchema = {
  step: (v: unknown) =>
    typeof v === 'number' && v >= 0 && v <= ONBOARDING_STEPS.COMPLETE ? v : undefined,
  complete: (v: unknown) => v === true,
  tutorialCompleted: (v: unknown) => v === true,
  resetTutorial: (v: unknown) => v === true,
  showContextualTooltips: (v: unknown) => typeof v === 'boolean' ? v : undefined,
}

/**
 * PATCH /api/onboarding
 * Update onboarding progress. Body: { step?, complete?, tutorialCompleted?, resetTutorial?, showContextualTooltips? }
 */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
      { status: 401 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const supabaseAdmin = getSupabaseAdmin()

    if (UpdateSchema.resetTutorial(body.resetTutorial)) {
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .upsert(
          {
            user_id: user.id,
            tutorial_completed_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      if (error) {
        console.error('Reset tutorial error:', error)
        return NextResponse.json({ error: 'Failed to reset tutorial' }, { status: 500 })
      }
      return NextResponse.json({ success: true, tutorialCompleted: false })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const step = UpdateSchema.step(body.step)
    if (step !== undefined) updates.onboarding_step = step
    if (UpdateSchema.complete(body.complete)) {
      updates.onboarding_completed_at = new Date().toISOString()
      updates.onboarding_step = ONBOARDING_STEPS.COMPLETE
    }
    if (UpdateSchema.tutorialCompleted(body.tutorialCompleted)) {
      updates.tutorial_completed_at = new Date().toISOString()
    }
    const showTooltips = UpdateSchema.showContextualTooltips(body.showContextualTooltips)
    if (showTooltips !== undefined) updates.show_contextual_tooltips = showTooltips

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ success: true })
    }

    const { error } = await supabaseAdmin
      .from('user_profiles')
      .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })

    if (error) {
      console.error('Onboarding update error:', error)
      return NextResponse.json(
        { error: 'Failed to update onboarding progress' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Onboarding PATCH error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
