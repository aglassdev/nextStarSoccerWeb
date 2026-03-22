import { useState, useRef, useEffect } from 'react';

import { databases, account, collections, databaseId } from '../services/appwrite';
import { ADMIN_CONFIG } from '../constants/adminConfig';
import Navigation from '../components/layout/Navigation';
import Lottie from 'lottie-web';

const subjectOptions = [
  'Individual Session',
  'Two Person Session',
  'Small Group Session',
  'Large Group Session',
  'Parent Consultation',
  'Game Analysis',
  'Player Report',
  'Team Training',
  'Camps',
  'Showcases',
  'Professional Clinics',
  'Payments',
  'Registration',
  'General Inquiry',
  'Other',
];

type FAQItem = {
  id: number;
  question: string;
  answer: string;
};

const paymentsFAQ: FAQItem[] = [
  {
    id: 1,
    question: 'How do payments work?',
    answer:
      'We send out a monthly bill on the first day of every month which covers all private sessions and calendered events that in the past month. For clinics, camps, and you can pay on signup and it is not included in your monthly bill.',
  },
  {
    id: 2,
    question: 'What payment methods do you accept?',
    answer:
      'We accept credit card, debit card, bank transfer, Apple Pay, and Google Pay.',
  },
  {
    id: 3,
    question: 'Is is safe to save my payment information on your app?',
    answer:
      'Yes we can guarantee its security. Payment details are stored in our Appwrite server, while payment transactions are secured by Stripe, both which offer industry-standard security. There is also a native layer of keychain encryption in the app as an additional layer.',
  },
  {
    id: 4,
    question: 'What is your cancellation and no-show policy?',
    answer:
      'Group Calendered Event  - No penalty for cancellation or no-show.\n \nPrivate Sessions - Half of the session price. (Excludes emergencies and injuries)\n \nPrepaid events - No penalty for cancellation or no-show. Credit is offered.',
  },
  {
    id: 5,
    question: 'What is your refund policy?',
    answer:
      'For any prepaid sessions or camps, we offer credit to future sessions or events. If that is not acceptable for you, you can contact us to request a full refund (minus any fees payed at the time of purchase).',
  },
  {
    id: 6,
    question: 'Who is allowed to make payments?',
    answer:
      'We allow all parents and any players 16 or older to make payments. For players under 16, we require a parent to have their own account to make payments on their behalf. Players over the age of 16 can still have payments made by their parents, as long as their accounts are connected.',
  },
];

const playerFAQ: FAQItem[] = [
  {
    id: 7,
    question: 'How do I sign up for sessions?',
    answer:
      'All Large Group Sessions, recurring clinics, and camp sessions are listed on the Calendar page, where you can sign up for events. Any private sessions need to be requested in advance and are available on the Services page.',
  },
  {
    id: 8,
    question: 'Do I need to sign up in advance for a session?',
    answer:
      'Currently we do not require signing up in advance. We highly encourage signing up as it helps our coaches plan out sessions and helps us keep track of your attendance.',
  },
  {
    id: 9,
    question: 'How do I check in for sessions?',
    answer:
      'For events you have signed up for, the checkin window opens 30 minutes before an event starts and lasts all the way until 15 minutes after the event ends. It is a simple 2 click process, if you are unable to check in, the session coach can do it on your behalf.',
  },
  {
    id: 10,
    question: 'Does my parent need their own account?',
    answer:
      'No your parent is not required to have an account. If you or your parent wishes to manage your sessions and payments, you are welcome to connect accounts. For children under 16, we require a parent have their own account to make payments on their behalf.',
  },
  {
    id: 11,
    question: 'How do I know I am a fit at Next Star?',
    answer:
      'Next Star works with players of all ages, skill levels, and genders. No matter who you are or where you are in your soccer journey, we are here to help you achieve your goals and become the best possible player you can be.',
  },
  {
    id: 12,
    question: 'Do you offer any reduced pricing or scholarships?',
    answer:
      'We offer scholarships to select players. Scholarships are not open to general application and you must contact us directly to discuss it.',
  },
];

const parentsFAQ: FAQItem[] = [
  {
    id: 13,
    question: "How can I connect my kids' accounts?",
    answer:
      'Proceed to Account Center > My Family and follow the steps to connect your child\'s account.',
  },
  {
    id: 14,
    question: 'Does my child need to have an account to play at Next Star?',
    answer:
      'No they do not. We allow parents to register their child and fully manage sessions and payments. Eventually, when a child does sign up, their data and link to you will automatically be transferred to a real account. If your child does have the ability to make an account, we highly recommend it.',
  },
  {
    id: 15,
    question: "How can I manage my child's schedule?",
    answer:
      'Once your child\'s account is connected to yours, you can see all their sessions and payments on your account. You can add and remove sessions on their behalf or add and remove sessions that they have made.',
  },
  {
    id: 16,
    question: 'How can I make payments for my child?',
    answer:
      'In the Payment Center, you will see your child or children\'s monthly bills when they become available to you. Either of you can pay for the bill.',
  },
  {
    id: 17,
    question: 'How will you accommodate my child?',
    answer:
      'At Group Sessions or Camps, we pair them with players of the same skill level so they are comfortable then progressively move them up to harder opponents to help them learn and improve. If your child is not comfortable with the other players, we will create a entire session for them to do on their own which the coaches will overlook, instruct, and help while managing the main session.',
  },
];

const coachesFAQ: FAQItem[] = [
  {
    id: 18,
    question: 'How do I sign up for sessions?',
    answer:
      'On your Coach Dashboard, you will see calendar of all upcoming sessions. There you can sign up for calendared events. For private sessions, a head coach will assign you to a session.',
  },
  {
    id: 19,
    question: 'How do I check in for sessions?',
    answer:
      'On your Coach Dashboard, if you click an event after the checkin window opens (30 minutes before), then you will be prompted to check in.',
  },
  {
    id: 20,
    question: 'How do I manage a session I am the coach of?',
    answer:
      'After checking in, you will be taken to the event management page. Here you can manage players signups, checkins, and cancel the event if need be.',
  },
];

const ContactPage = () => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [otherSubject, setOtherSubject] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    subject: false,
    message: false,
    other: false,
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const lottieContainer = useRef<HTMLDivElement>(null);
  const lottieInstance = useRef<any>(null);

  useEffect(() => {
    if (inquirySent && lottieContainer.current && !lottieInstance.current) {
      lottieInstance.current = Lottie.loadAnimation({
        container: lottieContainer.current,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        path: '/assets/animations/frame1.json',
      });
      lottieInstance.current.setSpeed(2);
    }

    return () => {
      if (lottieInstance.current) {
        lottieInstance.current.destroy();
        lottieInstance.current = null;
      }
    };
  }, [inquirySent]);

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    setFieldErrors((prev) => ({ ...prev, [field]: false }));
  };

  const handleBlur = (field: keyof typeof fieldErrors, value: string) => {
    if (value.trim() === '') {
      setFieldErrors((prev) => ({ ...prev, [field]: true }));
    }
  };

  const handleSend = async () => {
    const errors = {
      subject: subject.trim() === '',
      message: message.trim() === '',
      other: subject === 'Other' && otherSubject.trim() === '',
    };

    setFieldErrors(errors);

    const hasErrors = Object.values(errors).some(Boolean);
    if (!hasErrors) {
      const fullSubject = subject === 'Other' ? otherSubject : subject;

      try {
        const currentUser = await account.get();

        let userData = null;

        const collectionIds = [
          collections.parentUsers,
          collections.youthPlayers,
          collections.collegiatePlayers,
          collections.professionalPlayers,
        ];

        for (const collectionId of collectionIds) {
          try {
            const allDocs = await databases.listDocuments(databaseId, collectionId!);

            const userDoc = allDocs.documents.find((doc: any) => doc.userId === currentUser.$id);

            if (userDoc) {
              userData = userDoc;
              break;
            }
          } catch (error) {
            continue;
          }
        }

        const firstName = (userData as any)?.firstName || currentUser.name?.split(' ')[0] || 'Unknown';
        const lastName = (userData as any)?.lastName || currentUser.name?.split(' ')[1] || 'User';

        const documentData = {
          userId: currentUser.$id,
          firstName,
          lastName,
          subject: fullSubject,
          message,
          messageType: 'admin_message',
          recipientId: ADMIN_CONFIG.ADMIN_RECIPIENT_ID,
          senderId: currentUser.$id,
          read: false,
          timestamp: new Date().toISOString(),
        };

        await databases.createDocument(databaseId, collections.messages!, 'unique()', documentData);

        setInquirySent(true);
        setSubject('');
        setMessage('');
        setOtherSubject('');
        setFieldErrors({
          subject: false,
          message: false,
          other: false,
        });
      } catch (error) {
        console.error('Failed to send message to Appwrite:', error);
        alert('Failed to send message. Please try again.');
      }
    }
  };

  const handleReset = () => {
    setInquirySent(false);
  };

  const toggleExpanded = (itemId: number) => {
    const newExpandedItems = new Set(expandedItems);
    if (expandedItems.has(itemId)) {
      newExpandedItems.delete(itemId);
    } else {
      newExpandedItems.add(itemId);
    }
    setExpandedItems(newExpandedItems);
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderFAQSection = (items: FAQItem[], title: string, sectionId: string) => (
    <div id={sectionId} className="mt-12">
      <h2 className="text-3xl font-medium text-white text-center mb-8">{title}</h2>
      <div className="space-y-0">
        {items.map((item, index) => (
          <div key={item.id}>
            <button
              onClick={() => toggleExpanded(item.id)}
              className="w-full text-left py-6 px-4 hover:bg-zinc-900/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white pr-4 flex-1">{item.question}</h3>
                <svg
                  className={`w-3 h-3 text-white transition-transform duration-300 flex-shrink-0 ${
                    expandedItems.has(item.id) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {expandedItems.has(item.id) && (
                <div className="mt-4 pr-8">
                  <p className="text-base text-white whitespace-pre-line leading-relaxed">{item.answer}</p>
                </div>
              )}
            </button>

            {index < items.length - 1 && <div className="h-px bg-zinc-800" />}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <div className="pt-24 pb-16 px-4 max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-medium text-white mb-4">Inquire</h1>
          <p className="text-white max-w-2xl mx-auto px-4">
            This is for general inquiries about our services, methodology, payments, etc. To request
            sessions and services, there are specific pages located in{' '}
            <a href="/services" className="underline">
              Services
            </a>
            .
          </p>
        </div>

        {inquirySent ? (
          <div className="text-center mt-12 mb-12 animate-fadeIn">
            <div ref={lottieContainer} className="w-80 h-80 mx-auto" />
            <h2 className="text-xl text-white mb-3">Your inquiry has been sent!</h2>
            <div className="mb-8">
              <p className="text-white">
                Please check your{' '}
                <a href="/dashboard" className="underline">
                  Inbox
                </a>{' '}
                in the coming days.
              </p>
            </div>
            <button
              onClick={handleReset}
              className="bg-white text-black font-medium py-3 px-8 rounded-md hover:bg-gray-200 transition-colors"
            >
              Submit Another Inquiry
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto mt-8 mb-12">
            {/* Subject Dropdown */}
            <div className="mb-4 relative">
              <label className="block text-white text-sm mb-1">
                Subject<span className="text-red-600">*</span>
              </label>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`w-full h-11 px-3 bg-transparent border ${
                  fieldErrors.subject ? 'border-red-600' : 'border-white'
                } rounded text-left text-white flex items-center justify-between`}
              >
                <span className={subject ? 'text-white' : 'text-gray-500'}>
                  {subject || 'Select subject'}
                </span>
                <svg
                  className={`w-3 h-3 text-white transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute top-full mt-1 w-full bg-[#fdfdf9] rounded z-10 max-h-44 overflow-y-auto">
                  {subjectOptions.map((option, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setSubject(option);
                        setDropdownOpen(false);
                        clearFieldError('subject');
                      }}
                      className="w-full text-left py-2.5 px-3 text-black hover:bg-[#fdfdf9]/90 transition-colors"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Other Subject Input */}
            {subject === 'Other' && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Other"
                  value={otherSubject}
                  onChange={(e) => setOtherSubject(e.target.value)}
                  onFocus={() => clearFieldError('other')}
                  onBlur={() => handleBlur('other', otherSubject)}
                  className={`w-full h-11 px-3 bg-transparent border ${
                    fieldErrors.other ? 'border-red-600' : 'border-white'
                  } rounded text-white placeholder-gray-500`}
                />
              </div>
            )}

            {/* Message Textarea */}
            <div className="mb-4">
              <label className="block text-white text-sm mb-1">
                Message<span className="text-red-600">*</span>
              </label>
              <textarea
                placeholder="Write message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onFocus={() => clearFieldError('message')}
                onBlur={() => handleBlur('message', message)}
                className={`w-full h-40 px-3 py-2 bg-transparent border ${
                  fieldErrors.message ? 'border-red-600' : 'border-white'
                } rounded text-white placeholder-gray-500 resize-none`}
              />
            </div>

            {/* Send Button */}
            <div className="text-center mt-6">
              <button
                onClick={handleSend}
                className="bg-white text-black font-medium py-3 px-16 rounded-md hover:bg-gray-200 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-20">
          <h1 className="text-4xl md:text-5xl font-medium text-white text-center mb-8">FAQ</h1>

          {/* Navigation Bar */}
          <div className="flex justify-around border-b border-zinc-800 pb-3 mb-8">
            <button
              onClick={() => scrollToSection('payments')}
              className="text-white text-sm font-medium hover:text-gray-300 transition-colors"
            >
              Payments
            </button>
            <button
              onClick={() => scrollToSection('player')}
              className="text-white text-sm font-medium hover:text-gray-300 transition-colors"
            >
              Player
            </button>
            <button
              onClick={() => scrollToSection('parents')}
              className="text-white text-sm font-medium hover:text-gray-300 transition-colors"
            >
              Parents
            </button>
            <button
              onClick={() => scrollToSection('coaches')}
              className="text-white text-sm font-medium hover:text-gray-300 transition-colors"
            >
              Coaches
            </button>
          </div>

          {/* FAQ Sections */}
          {renderFAQSection(paymentsFAQ, 'Payments', 'payments')}
          {renderFAQSection(playerFAQ, 'Player', 'player')}
          {renderFAQSection(parentsFAQ, 'Parents', 'parents')}
          {renderFAQSection(coachesFAQ, 'Coaches', 'coaches')}
        </div>

        {/* Contact Information Footer */}
        <div className="mt-20 pt-12 border-t border-zinc-800 text-center">
          <div className="space-y-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Phone</p>
              <a href="tel:+15551234567" className="text-white text-lg hover:text-gray-300 transition-colors">
                (555) 123-4567
              </a>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Email</p>
              <a
                href="mailto:info@nextstarsoccer.com"
                className="text-white text-lg hover:text-gray-300 transition-colors"
              >
                info@nextstarsoccer.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
