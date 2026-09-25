import Hero from "../components/Hero.jsx";
import FakeNewsSection from "../components/FakeNewsSection.jsx";
import ControlSection from "../components/ControlSection.jsx";
import RealitySection from "../components/RealitySection.jsx";
import SolutionSection from "../components/SolutionSection.jsx";
import CheckSection from "../components/CheckSection.jsx";
import ComplaintSection from "../components/ComplaintSection.jsx";
import TrendingFakeSection from "../components/TrendingFakeSection.jsx";
import SimulatorSection from "../components/SimulatorSection.jsx";
import ReputationProtectorSection from "../components/ReputationProtectorSection.jsx";

function Home() {
  return (
    <main>
      <Hero />
      <FakeNewsSection />
      <ControlSection />
      <RealitySection />
      <SolutionSection />
      <TrendingFakeSection />
      <CheckSection />
      <SimulatorSection />
      <ReputationProtectorSection />
      <ComplaintSection />
    </main>
  );
}

export default Home;
