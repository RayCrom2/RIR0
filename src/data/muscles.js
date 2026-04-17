// Simple slug-keyed muscle dictionary for prototype usage
// Keys are base slugs (no .left or .right). Keep it small; expand as needed.
const muscles = {
  deltoids: {
    slug: 'deltoids',
    name: 'Deltoids',
    description:
      'The deltoid muscles form the rounded contour of the shoulder and are important for overhead pressing, abduction, and rotation of the arm.',
    tips:
      'Warm up with light rotations and band work. Prioritize form on overhead pressing to protect the shoulder joint.',
    exercises: ['Overhead Press', 'Lateral Raises', 'Cable Rear Delt Fly'],
    contraindications: ['Avoid heavy overhead work with existing impingement'],
    parts: [
      {
        key: 'anterior',
        name: 'Anterior Deltoid (Front)',
        description:
          'The anterior deltoid is the front portion of the deltoid group; it assists with shoulder flexion and horizontal adduction and is emphasized by pressing movements with a forward angle.',
        exercises: ['Front Raise', 'Incline Bench Press', 'Arnold Shoulder Press'],
        tips: 'Control the eccentric phase and avoid excessive internal rotation under heavy loads.',
      },
      {
        key: 'lateral',
        name: 'Lateral Deltoid (Middle)',
        description:
          'The lateral (middle) deltoid creates shoulder abduction and the rounded shoulder appearance; it is emphasized by lateral raises and wide pressing paths.',
        exercises: ['Lateral Raises', 'Upright Row', 'Cable lateral raises'],
        tips: 'Use strict form on lateral raises to isolate the lateral head; avoid heavy momentum.',
      },
      {
        key: 'posterior',
        name: 'Posterior Deltoid (Rear)',
        description:
          'The posterior deltoid is the rear portion important for horizontal abduction and external rotation and contributes to posture and pulling balance.',
        exercises: ['Cable Rear Delt Fly', 'Face Pull', 'Bent-over lateral raise'],
        tips: 'Prioritize scapular retraction and light, high-quality reps to target the posterior fibers.',
      },
    ],
  },

  forearm: {
    slug: 'forearm',
    name: 'Forearm (Flexors & Extensors)',
    description:
      'Forearm muscles control wrist and finger movement and contribute to grip strength. They are divided broadly into wrist/ finger flexors (anterior compartment) and extensors (posterior compartment).',
    tips:
      'Balance flexor and extensor work and prioritize controlled range of motion; progress grip training gradually to avoid tendon overload.',
    exercises: ['Wrist curl', 'Reverse wrist curl', 'Farmer carry', 'Hammer Curl'],
    contraindications: ['Progress cautiously after tendonitis or distal radius fractures'],
    parts: [
      {
        key: 'flexors',
        name: 'Wrist & Finger Flexors (Anterior)',
        description:
          'Anterior forearm muscles that flex the wrist and fingers and support gripping activities.',
        exercises: ['Wrist curl', 'Finger curls', 'Farmer carry'],
        tips: 'Use controlled tempo and avoid heavy ballistic loading when recovering from tendon issues.',
      },
      {
        key: 'extensors',
        name: 'Wrist & Finger Extensors (Posterior)',
        description:
          'Posterior forearm muscles that extend the wrist and fingers and help balance wrist joint mechanics.',
        exercises: ['Reverse wrist curl', 'Band wrist extension', 'Reverse curl'],
        tips: 'Train extensors with moderate volume to maintain balance and reduce risk of epicondylitis.',
      },
    ],
  },

  chest: {
    slug: 'chest',
    name: 'Chest (Pectorals)',
    description:
      'Pectoral muscles produce pushing motions and stabilization for the shoulder girdle.',
    tips: 'Control the descent in pressing movements and keep scapulae engaged.',
    exercises: ['Bench Press', 'Push-Ups', 'Chest Fly'],
    contraindications: ['Be cautious with heavy single-joint isolation if shoulder pain present'],
    parts: [
      {
        key: 'clavicular',
        name: 'Clavicular Head (Upper Chest)',
        description:
          'The clavicular head is the upper portion of the pectoralis major; it is emphasized by incline pressing and helps with shoulder flexion and horizontal adduction at higher angles.',
        exercises: ['Incline Bench Press', 'Incline dumbbell fly'],
        tips: 'Use controlled incline pressing with moderate range to target the upper fibers without overloading the shoulder.',
      },
      {
        key: 'sternal',
        name: 'Sternal Head (Lower Chest)',
        description:
          'The sternal head is the larger central/lower portion of the pectoralis major; it is emphasized by flat and decline pressing and is important in strong horizontal pressing.',
        exercises: ['Bench Press', 'Cable crossover (low to high)'],
        tips: 'Focus on full, controlled presses and maintain scapular stability.',
      },
      {
        key: 'minor',
        name: 'Pectoralis Minor',
        description:
          'A smaller muscle underneath the pectoralis major that stabilizes the scapula and assists in protraction; often involved in scapular mechanics and shoulder pain patterns.',
        exercises: ['Scapular push-ups', 'Serratus punches'],
        tips: 'Work on scapular control and mobility; avoid pressing variations that provoke scapular discomfort.',
      },
    ],
  },

  back: {
    slug: 'back',
    name: 'Back (Latissimus, Trapezius, Rhomboids)',
    description:
      'The large posterior muscles responsible for pulling, posture, and scapular control.',
    tips: 'Train pulling movements with full scapular retraction; maintain spinal neutrality.',
    exercises: ['Pull-ups', 'Seated Cable Row', 'Lat Pulldown'],
    contraindications: ['Avoid heavy rounding under load if lower-back pain exists'],
  },

  arms: {
    slug: 'arms',
    name: 'Arms (Biceps & Triceps)',
    description:
      'Includes elbow flexors (biceps) and extensors (triceps), important for most upper-body lifts.',
    tips: 'Balance flexor and extensor work to avoid imbalances and elbow irritation.',
    exercises: ['Barbell Bicep Curl', 'Triceps Pushdown', 'Hammer Curl'],
    contraindications: ['Be cautious with heavy overload after elbow tendonitis'],
  },

  core: {
    slug: 'core',
    name: 'Core (Abdominals & Stabilizers)',
    description:
      'The core stabilizes the spine and transmits force between upper and lower body.',
    tips: 'Prioritize bracing technique; start with isometric holds before complex loaded patterns.',
    exercises: ['Plank', 'Dead bug', 'Pallof press'],
    contraindications: ['Avoid Valsalva with uncontrolled hypertension'],
  },

  legs: {
    slug: 'legs',
    name: 'Legs (Quadriceps, Hamstrings, Glutes, Calves)',
    description:
      'Large lower-body muscle groups producing locomotion, knee/hip extension, and power.',
    tips: 'Balance squat and hinge patterns; progress range of motion before heavy loading.',
    exercises: ['Barbell Back Squat', 'Deadlift', 'Lunge', 'Calf Raise'],
    contraindications: ['Modify heavy loading for knee or hip pathology'],
  },

  // A few more specific examples
  biceps: {
    slug: 'biceps',
    name: 'Biceps Brachii',
    description: 'Elbow flexor and supinator of the forearm; common focus of isolation work.',
    tips: 'Use controlled eccentric phase and avoid excessive swinging.',
    exercises: ['Dumbbell Curl', 'Hammer Curl'],
    contraindications: ['Limit heavy isolation with active biceps tendon pain'],
    parts: [
      {
        key: 'long',
        name: 'Long Head (Outer Biceps)',
        description:
          'The long head of the biceps gives the peak to the biceps contour and assists with shoulder stabilization as well as elbow flexion.',
        exercises: ['Incline dumbbell curl', 'Concentration curl'],
        tips: 'Use slightly wider grips and incline variations to emphasize the long head.',
      },
      {
        key: 'short',
        name: 'Short Head (Inner Biceps)',
        description:
          'The short head contributes to the width of the biceps and is heavily involved in curling movements, especially with a narrow grip.',
        exercises: ['Barbell Bicep Curl (close grip)', 'Preacher Curl'],
        tips: 'Focus on contraction and supination to target the short head.',
      },
      {
        key: 'brachialis',
        name: 'Brachialis (Underneath)',
        description:
          'The brachialis lies beneath the biceps and is a strong elbow flexor; developing it increases overall upper-arm size and strength.',
        exercises: ['Hammer Curl', 'Reverse curl'],
        tips: 'Neutral-grip movements like hammer curls bias the brachialis.',
      },
    ],
  },

  triceps: {
    slug: 'triceps',
    name: 'Triceps Brachii',
    description: 'Primary elbow extensors; important for pushing strength.',
    tips: 'Use full range of motion and keep elbows stable during pressing.',
    exercises: ['Triceps Dip', 'Skull Crusher'],
    contraindications: [],
    parts: [
      {
        key: 'long',
        name: 'Long Head (Triceps)',
        description:
          'The long head crosses the shoulder joint and assists with shoulder extension as well as elbow extension; it contributes to overall triceps mass.',
        exercises: ['Overhead Triceps Extension', 'Close-Grip Bench Press'],
        tips: 'Overhead movements place the long head on stretch and emphasize it.',
      },
      {
        key: 'lateral',
        name: 'Lateral Head (Outer Triceps)',
        description:
          'The lateral head is visible on the outer arm and is strongly recruited in heavy extension movements.',
        exercises: ['Triceps Pushdown', 'Cable pressdown (rope)'],
        tips: 'Use high-tension, controlled reps to develop the lateral head.',
      },
      {
        key: 'medial',
        name: 'Medial Head (Deep)',
        description:
          'The medial head lies deeper and contributes to elbow extension across varied positions; it is important for endurance work.',
        exercises: ['Reverse-grip pushdown', 'Dumbbell kickback'],
        tips: 'Higher-rep work and attention to full lockout can help target the medial head.',
      },
    ],
  },

  abs: {
    slug: 'abs',
    name: 'Abdominals',
    description:
      'The rectus abdominis and surrounding abdominal muscles stabilize the trunk, resist extension, and assist with flexion and intra-abdominal pressure.',
    tips: 'Train bracing and anti-extension before heavy dynamic flexion; progress core load gradually.',
    exercises: ['Plank', 'Hollow body hold', 'Dead bug'],
    contraindications: ['Avoid loaded spinal flexion with acute low-back pain'],
  },

  obliques: {
    slug: 'obliques',
    name: 'Obliques (Internal & External)',
    description:
      'The obliques run on the sides of the abdomen and control rotation, lateral flexion, and contribute to trunk stability and force transfer.',
    tips: 'Emphasize anti-rotation and controlled rotational work; avoid excessive ballistic twisting if you have spine issues.',
    exercises: ['Pallof press', 'Russian twist (light)', 'Side plank'],
    contraindications: ['Caution with explosive rotation after hernia or low-back surgery'],
  },

  trapezius: {
    slug: 'trapezius',
    name: 'Trapezius',
    description:
      'The trapezius spans the neck and upper back (upper/middle/lower fibers) and controls scapular elevation, retraction, and depression.',
    tips: 'Balance upper-trap loading with mid/lower trap strengthening and scapular control work.',
    exercises: ['Shoulder Shrug', 'Face Pull', 'Scapular retraction rows'],
    contraindications: ['Avoid heavy shrugging with neck pain or acute disc issues'],
  },

  neck: {
    slug: 'neck',
    name: 'Neck (Cervical stabilizers)',
    description:
      'Neck muscles support and move the head and stabilize the cervical spine; they include the sternocleidomastoid, scalenes, splenius and deep cervical extensors.',
    tips:
      'Prioritize posture, gentle mobility, and isometric strengthening; avoid high-velocity or heavy axial loading if symptomatic.',
    exercises: ['Chin tuck (isometric)', 'Neck extension holds (light)', 'Scapular retraction rows'],
    contraindications: ['Avoid loaded cervical flexion/extension with radicular symptoms or acute instability'],
  },

  quadriceps: {
    slug: 'quadriceps',
    name: 'Quadriceps',
    description:
      'The quadriceps are the primary knee extensors and drive standing/locomotive power; they include four heads (rectus femoris, vastus lateralis/medialis/intermedius).',
    tips: 'Train both squat and knee-dominant patterns; emphasize full range and ankle mobility for depth.',
    exercises: ['Barbell Back Squat', 'Front Squat', 'Leg Press'],
    contraindications: ['Adjust depth/weight for knee joint replacements or acute patellar pain'],
  },

  hamstring: {
    slug: 'hamstring',
    name: 'Hamstring',
    description:
      'Posterior thigh muscles responsible for knee flexion and hip extension; important for running, hinge patterns, and posterior chain strength.',
    tips: 'Include both eccentric-focused and hip-dominant variations to build resilience.',
    exercises: ['Romanian Deadlift', 'Nordic Curl', 'Glute-ham raise'],
    contraindications: ['Progress eccentrics carefully after strain injuries'],
  },

  lowerback: {
    slug: 'lowerback',
    name: 'Lower Back (Erector Spinae & Multifidus)',
    description:
      'Paraspinal muscles that maintain spinal extension and segmental stability; critical for safe lifting and posture.',
    tips: 'Prioritize intra-abdominal bracing and progressive loading; avoid repeated unsupported flexion under load.',
    exercises: ['Bird dog', 'Back extension (controlled)', 'Deadlift'],
    contraindications: ['Avoid ballistic spinal flexion with acute disc pathology'],
  },

  gluteal: {
    slug: 'gluteal',
    name: 'Gluteal Muscles (Gluteus Maximus/Med/Min)',
    description:
      'Gluteal muscles power hip extension, external rotation, and help stabilize the pelvis during gait and single-leg tasks.',
    tips: 'Prioritize hip-hinge patterns and single-leg strength for balanced glute development; cue glute activation before loading.',
    exercises: ['Hip Thrust', 'Romanian Deadlift', 'Bulgarian Split Squat'],
    contraindications: ['Modify heavy hip extension for acute hamstring or hip bursitis'],
  },

  upperback: {
    slug: 'upperback',
    name: 'Upper Back (Rhomboids & Upper Lat/Trapezius)',
    description:
      'Includes muscles that retract and stabilize the scapula and support posture and powerful pulling motions.',
    tips: 'Emphasize scapular retraction and mid-trap activation in pulling work.',
    exercises: ['Seated Cable Row', 'Face Pull', 'Scapular wall slides'],
    contraindications: [],
  },

  adductors: {
    slug: 'adductors',
    name: 'Adductors',
    description:
      'Inner-thigh muscles that bring the leg toward the midline and assist in hip stabilization and transfer of force.',
    tips: 'Include single-leg and adduction-specific work to reduce groin injury risk.',
    exercises: ['Copenhagen adduction', 'Adductor machine', 'Sumo deadlift variant'],
    contraindications: ['Take care after groin strains; progress slowly'],
  },

  abductors: {
    slug: 'abductors',
    name: 'Hip Abductors (Gluteus Medius & Minimus)',
    description:
      'Hip abductors on the lateral thigh (primarily gluteus medius and minimus) move the leg away from the body, control pelvic tilt during single-leg stance, and are critical for knee alignment and gait.',
    tips:
      'Prioritize neuromuscular control and single-leg stability before heavy loading; progress banded work to loaded single-leg variations.',
    exercises: [
      'Clamshells',
      'Banded lateral walk',
      'Single-leg Romanian deadlift',
      'Hip abduction machine',
    ],
    contraindications: ['Progress cautiously after hip bursitis or glute med tendinopathy'],
    parts: [
      {
        key: 'medius',
        name: 'Gluteus Medius',
        description:
          'Primary hip abductor and pelvis stabilizer active in single-leg stance; important for preventing knee valgus.',
        exercises: ['Banded lateral walk', 'Single-leg squat (assisted)', 'Clamshells'],
        tips: 'Focus on small, controlled abduction ranges and pelvic stability before adding heavy resistance.',
      },
      {
        key: 'minimus',
        name: 'Gluteus Minimus',
        description:
          'Smaller abductor lying beneath the medius that assists with internal rotation and fine control of hip abduction.',
        exercises: ['Side-lying hip abduction', 'Cable hip abduction', 'Monster walks (light resistance)'],
        tips: 'Use higher-rep, low-load work to target endurance and motor control.',
      },
    ],
  },

  calves: {
    slug: 'calves',
    name: 'Calves (Gastrocnemius & Soleus)',
    description:
      'Calf muscles allow ankle plantarflexion and contribute to walking, running, and jumping.',
    tips: 'Train both seated and standing calf variations to target soleus and gastrocnemius respectively.',
    exercises: ['Standing calf raise', 'Seated calf raise', 'Farmer carry on toes'],
    contraindications: ['Progress volumes carefully after Achilles issues'],
  },
}

export default muscles
