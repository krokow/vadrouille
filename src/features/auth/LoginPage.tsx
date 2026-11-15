import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { MailCheck, Sparkles, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { backend, isDemo } from '@/lib/backend'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Wordmark } from '@/components/Logo'
import { useAuth, rememberNext } from './AuthProvider'

const schema = z.object({ email: z.string().trim().email('Adresse e-mail invalide') })
const COOLDOWN = 60

export function LoginPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (user) return <Navigate to={next} replace />

  const send = async (email: string) => {
    try {
      rememberNext(next)
      await backend.sendMagicLink(email, next)
      setSentTo(email)
      setCooldown(COOLDOWN)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(/rate limit|seconds/i.test(msg) ? 'Trop de demandes : réessaie dans une minute.' : msg)
    }
  }

  const verify = async () => {
    if (!sentTo) return
    setVerifying(true)
    try {
      await backend.verifyCode(sentTo, code.trim())
    } catch {
      toast.error('Code invalide ou expiré')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 paper">
      <Wordmark className="mb-8" />
      <Card className="w-full max-w-sm p-6">
        {!sentTo ? (
          <form onSubmit={form.handleSubmit((v) => send(v.email))} className="space-y-4" noValidate>
            <div>
              <h1 className="text-2xl font-semibold">{t('Connexion')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Pas de mot de passe : on t'envoie un lien magique par e-mail.
              </p>
            </div>
            <Field label="Adresse e-mail" htmlFor="email" error={form.formState.errors.email?.message}>
              <Input
                id="email" type="email" autoComplete="email" inputMode="email" placeholder="toi@exemple.fr" autoFocus
                aria-invalid={!!form.formState.errors.email}
                {...form.register('email')}
              />
            </Field>
            <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {isDemo ? 'Entrer (mode démo)' : t('Recevoir mon lien de connexion')}
            </Button>
            {isDemo && (
              <p className="rounded-xl bg-accent p-3 text-xs text-accent-foreground">
                <strong>Mode démo</strong> : aucune base Supabase n'est configurée, tes données restent dans ce navigateur.
                Astuce : ouvre un 2ᵉ onglet en navigation privée avec un autre e-mail pour tester la collaboration.
              </p>
            )}
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <MailCheck className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Lien envoyé !</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ouvre l'e-mail envoyé à <strong className="text-foreground">{sentTo}</strong> et clique sur le lien.
              </p>
            </div>
            <p className="rounded-xl bg-warning/15 px-3 py-2 text-sm font-semibold">📬 {t('Pense à vérifier tes spams')}</p>
            <div className="space-y-2 text-left">
              <Field label="Ou saisis le code reçu" htmlFor="code" hint="Pratique si le lien s'ouvre dans un autre navigateur (app installée).">
                <div className="flex gap-2">
                  <Input
                    id="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={10}
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="tracking-[0.3em]"
                  />
                  <Button onClick={verify} disabled={code.length < 6 || verifying} aria-label="Valider le code">
                    {verifying ? <Loader2 className="animate-spin" /> : <KeyRound />}
                  </Button>
                </div>
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" disabled={cooldown > 0} onClick={() => send(sentTo)}>
                {t('Renvoyer le lien')}{cooldown > 0 ? ` (${cooldown} s)` : ''}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSentTo(null)}>
                Changer d'adresse
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
