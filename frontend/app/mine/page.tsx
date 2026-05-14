import { MiningControls } from '@/components/feature/mining-controls';
import { MiningStats } from '@/components/feature/mining-stats';

export default function MinePage() {
  return (
    <section className="container py-10 md:py-16 space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Mine POSCI</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Brute-force keccak256 hashes from your browser. CPU and GPU run in parallel; first hit auto-submits.
        </p>
      </div>
      <MiningStats />
      <MiningControls />
    </section>
  );
}
