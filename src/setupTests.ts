import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// The Schedule page tests are heavy and CI runners are slower and noisier than a laptop: a test
// that takes 1s locally takes 2.5s or more there, so the 1s default of findBy* and waitFor timed
// out on real, correct renders. A passing query returns at once; only a failing one waits longer.
configure({ asyncUtilTimeout: 5000 });
