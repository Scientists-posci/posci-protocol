import { GenesisWidget } from '@/components/feature/genesis-widget';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Atom, Coins, Lock, Rocket } from 'lucide-react';

export default function GenesisPage() {
  return (
    <section className="container py-10 md:py-16 grid lg:grid-cols-[1fr_minmax(380px,440px)] gap-8 items-start">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Genesis Sale</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            A 0.5 ETH cap, then the pool goes live <em>in the same transaction</em>. No team wallet ever touches the ETH — the contract pipes it directly into Uniswap V4 and burns the LP NFT.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: Coins, title: 'Fixed price',  body: '1 ETH = 500,000 POSCI. Same number that seeds the initial pool.' },
            { icon: Lock,  title: 'No control',   body: 'No owner. No upgrade path. The contract has no withdrawal function.' },
            { icon: Rocket,title: 'Atomic launch',body: 'The buy that fills the cap also creates the V4 pool and burns LP. One tx.' },
            { icon: Atom,  title: 'Then mining',  body: 'Bootstrap flips the second mining gate. Everyone can start mining the remaining 20M.' },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title} className="border-border/40">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/15">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">{body}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <GenesisWidget />
    </section>
  );
}
