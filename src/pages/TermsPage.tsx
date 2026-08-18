import { useRef } from 'react';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';

const termsHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;background:#fff;}
.doc{max-width:800px;margin:0 auto;padding:48px 56px 96px;}
h1.title{text-align:center;font-size:24px;margin:0 0 4px;}
.updated{text-align:center;color:#555;font-size:13px;margin-bottom:36px;}
h2{font-size:16px;margin:30px 0 8px;border-bottom:1px solid #e2e2e2;padding-bottom:6px;}
h2 .num{color:#888;margin-right:6px;}
h3{font-size:13.5px;margin:14px 0 4px;}
p{margin:0 0 12px;line-height:1.6;font-size:14.5px;}
ul,ol{margin:0 0 12px;padding-left:22px;}
li{margin-bottom:5px;line-height:1.6;font-size:14.5px;}
.caps{text-transform:uppercase;font-size:13px;}
a{color:#1E40AF;}
.toc{columns:2;column-gap:28px;padding-left:18px;font-size:13.5px;margin-bottom:8px;}
.toc li{margin-bottom:6px;break-inside:avoid;list-style:decimal;}
.toc a{color:#111;text-decoration:none;}
.toc a:hover{text-decoration:underline;}
hr{border:none;border-top:1px solid #ddd;margin:32px 0;}
footer.contact{font-size:14.5px;line-height:1.7;}
</style></head><body><div class="doc">

<h1 class="title">NEXT STAR SOCCER LLC TERMS OF SERVICE</h1>
<div class="updated"><strong>Last updated August 24, 2026</strong></div>

<h2 style="border:none;">Table of Contents</h2>
<ol class="toc">
<li><a href="#s1">Agreement to These Terms</a></li>
<li><a href="#s2">Definitions</a></li>
<li><a href="#s3">Our Services</a></li>
<li><a href="#s4">Description of Training Services</a></li>
<li><a href="#s5">Intellectual Property Rights</a></li>
<li><a href="#s6">User Representations</a></li>
<li><a href="#s7">Account Registration and Eligibility; Minors</a></li>
<li><a href="#s8">No Guarantee of Availability</a></li>
<li><a href="#s9">Scheduling Changes, Cancellations, and Makeup Sessions</a></li>
<li><a href="#s10">Assumption of Risk; Waiver and Release of Liability</a></li>
<li><a href="#s11">Medical Emergencies and Treatment Authorization</a></li>
<li><a href="#s12">Health, Fitness, and Medical Disclosure</a></li>
<li><a href="#s13">Code of Conduct</a></li>
<li><a href="#s14">Photo, Video, and Media Release</a></li>
<li><a href="#s15">Personal Property</a></li>
<li><a href="#s16">Weather, Facilities, and Force Majeure</a></li>
<li><a href="#s17">No Guarantee of Results</a></li>
<li><a href="#s18">Purchases and Payment</a></li>
<li><a href="#s19">Late Payments and Suspension for Non-Payment</a></li>
<li><a href="#s20">Refunds and Credits</a></li>
<li><a href="#s21">Right to Refuse Service; Suspension and Termination</a></li>
<li><a href="#s22">Term and Termination</a></li>
<li><a href="#s23">Modifications and Interruptions</a></li>
<li><a href="#s24">Non-Solicitation of Coaches</a></li>
<li><a href="#s25">Communications</a></li>
<li><a href="#s26">Electronic Communications, Transactions, and Signatures</a></li>
<li><a href="#s27">Prohibited Activities</a></li>
<li><a href="#s28">User Generated Contributions</a></li>
<li><a href="#s29">Contribution Licence</a></li>
<li><a href="#s30">Mobile Application Licence</a></li>
<li><a href="#s31">Third-Party Websites and Content</a></li>
<li><a href="#s32">Services Management</a></li>
<li><a href="#s33">Corrections</a></li>
<li><a href="#s34">Privacy Policy</a></li>
<li><a href="#s35">Disclaimer of Warranties</a></li>
<li><a href="#s36">Limitation of Liability</a></li>
<li><a href="#s37">Indemnification</a></li>
<li><a href="#s38">User Data</a></li>
<li><a href="#s39">Governing Law</a></li>
<li><a href="#s40">Dispute Resolution</a></li>
<li><a href="#s41">California Users and Residents</a></li>
<li><a href="#s42">General Provisions</a></li>
<li><a href="#s43">Changes to These Terms</a></li>
<li><a href="#s44">Contact Us</a></li>
</ol>

<h2 id="s1"><span class="num">1.</span>Agreement to These Terms</h2>
<p>We are Next Star Soccer LLC, doing business as Next Star LLC ("Company," "we," "us," or "our"), a company registered in Maryland, United States at 5508 Ridgefield Road, Bethesda, MD 20816.</p>
<p>We operate the website nextstarsoccer.com (the "Site"), the mobile application Next Star (the "App"), and provide youth, collegiate, and professional soccer training sessions, team training events, camps, and clinics, together with any other related products and services that refer or link to these legal terms (collectively, the "Legal Terms") (collectively with the Site and the App, the "Services").</p>
<p>You can contact us by phone at 1-301-728-0764, email at info@nextstarsoccer.com, or by mail to 5508 Ridgefield Road, Bethesda, MD 20816, United States.</p>
<p>These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you"), and Next Star Soccer LLC concerning your access to and use of the Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by all of these Legal Terms, including the assumption of risk and waiver of liability in Section 10 and the medical treatment authorization in Section 11.</p>
<p class="caps"><strong>If you do not agree with all of these legal terms, then you are expressly prohibited from using the services and you must discontinue use immediately.</strong></p>
<p>We will provide you with prior notice of any scheduled changes to the Services you are using. The modified Legal Terms will become effective upon posting or notifying you at info@nextstarsoccer.com, as stated in the notice. By continuing to use the Services after the effective date of any changes, you agree to be bound by the modified terms.</p>
<p>All users who are minors in the jurisdiction in which they reside (generally under the age of 18) must have the permission of, and be directly supervised by, their parent or guardian to use the Site and the App. If you are a minor, your parent or guardian must read and agree to these Legal Terms — including Section 10 (Assumption of Risk and Waiver of Liability) and Section 11 (Medical Treatment Authorization) — before you use the Services.</p>
<p>We recommend that you print or save a copy of these Legal Terms for your records.</p>

<h2 id="s2"><span class="num">2.</span>Definitions</h2>
<ul>
<li><strong>"Participant"</strong> means the individual who takes part in the Services — which may be you, or a youth, collegiate, or professional player you register (such as your child or ward).</li>
<li><strong>"Client," "you," "your"</strong> means the person who creates the account, books Services, or is financially responsible for charges, whether or not that person is also the Participant.</li>
<li><strong>"Coach"</strong> means any coach, trainer, or staff member who delivers the Services, whether an employee or independent contractor of the Company.</li>
<li><strong>"Programs" or "Sessions"</strong> means individual training, group training, team training events, camps, clinics, and any other coaching activity offered through the Services.</li>
</ul>

<h2 id="s3"><span class="num">3.</span>Our Services</h2>
<p>The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation, or which would subject the Company to any registration requirement within such jurisdiction or country. Persons who choose to access the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws, to the extent local laws are applicable.</p>

<h2 id="s4"><span class="num">4.</span>Description of Training Services</h2>
<p>The Company provides youth, collegiate, and professional soccer training, including individual sessions, group sessions, team training events, camps, and clinics, along with a Site and App for scheduling, billing, and communication. The Company may add, remove, modify, or discontinue any Program, Coach, curriculum, format, or pricing at any time and at its sole discretion.</p>

<h2 id="s5"><span class="num">5.</span>Intellectual Property Rights</h2>
<h3>Our intellectual property</h3>
<p>We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website and app designs, audio, video, text, photographs, and graphics in the Services (collectively, the "Content"), as well as the trademarks, service marks, and logos contained therein (the "Marks"). Our Content and Marks are protected by copyright and trademark laws (and various other intellectual property rights and unfair competition laws) and treaties in the United States and around the world. The Content and Marks are provided in or through the Services "AS IS" for your personal, non-commercial use only.</p>
<h3>Your use of our Services</h3>
<p>Subject to your compliance with these Legal Terms, we grant you a non-exclusive, non-transferable, revocable licence to access the Services and to download or print a copy of any portion of the Content to which you have properly gained access, solely for your personal, non-commercial use. Except as set out in this section or elsewhere in our Legal Terms, no part of the Services and no Content or Marks may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose whatsoever, without our express prior written permission.</p>

<h2 id="s6"><span class="num">6.</span>User Representations</h2>
<p>By using the Services, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information; (3) you have the legal capacity and agree to comply with these Legal Terms; (4) you are not a minor, or if a minor, your parent or guardian has agreed to these Legal Terms on your behalf; (5) you will not access the Services through automated or non-human means; (6) you will not use the Services for any illegal or unauthorised purpose; and (7) your use of the Services will not violate any applicable law or regulation.</p>

<h2 id="s7"><span class="num">7.</span>Account Registration and Eligibility; Minors</h2>
<p>You may be required to register an account to use the Services. To create an account, you must be at least 18 years old, or a parent or legal guardian creating an account on behalf of a minor Participant.</p>
<p>You agree to keep your password confidential and are responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a username or account handle you select if we determine, in our sole discretion, that it is inappropriate, obscene, or otherwise objectionable.</p>
<p>If you register a minor Participant, you represent that you are that Participant's parent or legal guardian, or otherwise have full legal authority to enter into these Legal Terms — including Section 10 (Assumption of Risk and Waiver of Liability) and Section 11 (Medical Treatment Authorization) — on the Participant's behalf.</p>
<p>Where more than one guardian or family member is linked to a Participant's profile (for example, through our family account or invitation features), each linked adult may be held jointly and severally responsible for charges on that Participant's account unless we agree otherwise in writing.</p>

<h2 id="s8"><span class="num">8.</span>No Guarantee of Availability</h2>
<p>Requests for a specific Coach, date, time, location, or Program are requests only. The Company does not guarantee that any particular Coach will be available, that a requested date or time will be honored, or that any specific Service will be offered at any given time. The Company may limit enrollment, waitlist requests, or decline a requested booking at its discretion.</p>

<h2 id="s9"><span class="num">9.</span>Scheduling Changes, Cancellations, and Makeup Sessions</h2>
<p>The Company may change, reschedule, or cancel any session, event, or Program at any time and for any reason — including Coach unavailability, weather, facility issues, low enrollment, or other operational needs — with or without advance notice. We will make reasonable efforts to notify you as soon as practicable when this happens.</p>
<p>As a courtesy, and not as a guaranteed entitlement, the Company may — at its sole discretion — offer a free or discounted makeup session when it cancels a session. This is a discretionary practice the Company may change, limit, or discontinue at any time without notice, and nothing in this Section obligates the Company to provide a makeup session, credit, or refund for any cancelled or modified session.</p>
<p>Client-requested cancellations or reschedules are subject to the scheduling policy provided to you at booking.</p>

<h2 id="s10"><span class="num">10.</span>Assumption of Risk; Waiver and Release of Liability</h2>
<h3>10.1 Inherent Risks</h3>
<p>Soccer and related athletic training involve inherent risks of physical injury — including sprains, strains, fractures, concussion or other head injury, heat-related illness, cardiac events, permanent disability, and death — that may result from the Participant's own actions, the actions of others, equipment, playing or training surfaces, weather, or the ordinary negligence of the Company or its Coaches, employees, contractors, or agents.</p>
<h3>10.2 Voluntary Assumption of Risk</h3>
<p>You, on behalf of yourself and, if applicable, the Participant, voluntarily and knowingly assume all such risks, known and unknown, arising from participation in the Services.</p>
<h3>10.3 Waiver and Release</h3>
<p>To the fullest extent permitted by law, you release, waive, and discharge the Company, its owners, officers, employees, Coaches, contractors, and agents (the "Released Parties") from any and all claims, demands, or causes of action arising from any injury, illness, death, or property damage sustained in connection with the Services, including claims based on the ordinary negligence of a Released Party. This release does not extend to a Released Party's gross negligence, recklessness, or willful misconduct.</p>
<h3>10.4 Waivers Signed on Behalf of a Minor</h3>
<p>Some states, including Maryland, limit a parent's or guardian's authority to waive a minor's own right to sue for negligence. Accordingly, if you sign on behalf of a minor Participant: (a) this release fully applies to your own claims (including any claim for medical expenses, loss of services, or emotional distress); and (b) to the extent the law does not allow you to waive the Participant's own claim, you separately agree, to the fullest extent permitted by law, to indemnify and hold harmless the Released Parties from any such claim brought by or on behalf of the Participant, as further described in Section 37.</p>
<h3>10.5 Survival</h3>
<p>This Section survives the end of your relationship with the Company and applies to any future Services, unless the Company provides a separate written waiver for a specific event.</p>

<h2 id="s11"><span class="num">11.</span>Medical Emergencies and Treatment Authorization</h2>
<p>If a Participant is injured or experiences a medical emergency during the Services, you authorize the Company's Coaches and staff to administer basic first aid, contact emergency medical services (911), and, if needed, arrange transportation to a medical facility. You agree that the Company has no obligation to provide medical care beyond basic first aid and summoning emergency assistance, and that you are solely responsible for all costs of any medical care or transportation. The Company will make reasonable efforts to contact you or your designated emergency contact as soon as practicable.</p>

<h2 id="s12"><span class="num">12.</span>Health, Fitness, and Medical Disclosure</h2>
<p>By enrolling a Participant in the Services, you represent that the Participant is physically fit to participate in soccer training, or that you have consulted a physician and confirmed it is safe for them to do so. Company Coaches and staff are not medical professionals and do not provide medical advice, diagnosis, or treatment. You agree to keep the Participant's emergency contact information, and any relevant medical conditions, allergies, or physical limitations, up to date with the Company, and to promptly notify Company staff or the assigned Coach of any condition that could affect the Participant's safe participation.</p>

<h2 id="s13"><span class="num">13.</span>Code of Conduct</h2>
<p>Participants, parents, guardians, and spectators are expected to treat Coaches, staff, other participants, and facilities with respect. The Company may remove any person from a session, event, or facility, and may suspend or terminate their participation in the Services under Section 21, without refund, for conduct that the Company determines, in its sole discretion, to be unsafe, abusive, threatening, disruptive, or otherwise inappropriate.</p>

<h2 id="s14"><span class="num">14.</span>Photo, Video, and Media Release</h2>
<p>The Company may photograph or record sessions and events. Unless you notify us in writing at info@nextstarsoccer.com that you withhold consent, you grant the Company a non-exclusive, royalty-free, worldwide right to use photos, video, and other recordings of the Participant taken during the Services for coaching, promotional, marketing, and social media purposes, without compensation.</p>

<h2 id="s15"><span class="num">15.</span>Personal Property</h2>
<p>The Company is not responsible for personal belongings lost, stolen, or damaged at any facility, field, or event where Services are provided.</p>

<h2 id="s16"><span class="num">16.</span>Weather, Facilities, and Force Majeure</h2>
<p>Some Services take place outdoors and are subject to weather conditions. Some Services take place at fields, gyms, or other facilities the Company does not own or operate, and Participants and guardians must follow the rules of those facilities. The Company is not liable for any delay, cancellation, or inability to perform the Services due to causes beyond its reasonable control, including weather, natural disaster, government action, public health emergency, facility unavailability, power or utility failure, or other events of force majeure.</p>

<h2 id="s17"><span class="num">17.</span>No Guarantee of Results</h2>
<p>The Company does not guarantee any specific outcome from participation in the Services, including improvement in skill or fitness, placement on any team, college recruitment, athletic scholarships, or professional opportunities. Any references to past outcomes are illustrative only and are not a promise of similar results.</p>

<h2 id="s18"><span class="num">18.</span>Purchases and Payment</h2>
<p>We accept the following forms of payment: Visa, Mastercard, American Express, Diners Club, JCB, UnionPay, Apple Pay, Google Pay, ACH direct debit, and bank transfer.</p>
<p>You agree to provide current, complete, and accurate purchase and account information for all purchases made via the Services. All payments shall be in US dollars.</p>
<p>Unless otherwise stated at checkout, invoices are due within ten (10) days of issuance. If you are experiencing a billing discrepancy or financial hardship, contact us at info@nextstarsoccer.com before the due date and we will work with you on an extension; extensions requested after the due date has passed are granted at the Company's discretion.</p>
<p>Purchased session packages or credits are non-transferable between families and expire twelve (12) months after purchase unless otherwise stated at checkout.</p>

<h2 id="s19"><span class="num">19.</span>Late Payments and Suspension for Non-Payment</h2>
<p>A bill not paid by its due date (or extended due date under Section 18) is overdue. Overdue balances accrue a one-time late fee equal to 10% of the overdue amount.</p>
<p>While a balance is overdue, the Participant may attend one (1) additional complimentary session. After that session, the Participant may not attend any further session or use any other Service until the full outstanding balance, including any late fee, is paid in full. The Company may also suspend or terminate the account under Section 21.</p>

<h2 id="s20"><span class="num">20.</span>Refunds and Credits</h2>
<p>Refunds and credits are issued at the Company's discretion and may include: charges made in error or duplicate; sessions the Company cancels and does not make up; or other circumstances the Company determines warrant one. To request a refund or credit, contact info@nextstarsoccer.com. Approved refunds may be issued to your original payment method or as account credit, at the Company's discretion, unless applicable law requires otherwise.</p>

<h2 id="s21"><span class="num">21.</span>Right to Refuse Service; Suspension and Termination</h2>
<p>The Company may refuse, restrict, suspend, or terminate any person's access to or participation in the Services at any time, with or without notice, and with or without refund, for any lawful reason at its sole discretion — including for safety concerns, non-payment, a violation of these Legal Terms, or conduct described in Section 13. The Company will not refuse service on any basis prohibited by applicable law.</p>

<h2 id="s22"><span class="num">22.</span>Term and Termination</h2>
<p>These Legal Terms shall remain in full force and effect while you use the Services. We reserve the right to deny access to or use of the Services to any person, to terminate a Client's or Participant's use of the Services, or to delete any account, at any time, without warning, at our sole discretion, in addition to our rights under Section 21.</p>

<h2 id="s23"><span class="num">23.</span>Modifications and Interruptions</h2>
<p>We reserve the right to change, modify, or remove the contents of the Site and App at any time or for any reason at our sole discretion, without notice. We cannot guarantee the Site or App will be available at all times. We may experience hardware, software, or other problems, or need to perform maintenance related to the Site or App, resulting in interruptions, delays, or errors. We will not be liable for any loss, damage, or inconvenience caused by your inability to access or use the Site or App during any downtime.</p>

<h2 id="s24"><span class="num">24.</span>Non-Solicitation of Coaches</h2>
<p>While enrolled in the Services and for twelve (12) months after your last session, you agree not to directly engage or hire any Coach you were introduced to through the Company to provide private soccer training or coaching outside of the Services, without the Company's prior written consent.</p>

<h2 id="s25"><span class="num">25.</span>Communications</h2>
<p>By providing a phone number or email address, you consent to receive communications from the Company related to scheduling, billing, and your account by email, text message, phone, or app push notification, which may be automated. You may opt out of non-essential marketing communications at any time; you may not opt out of essential transactional communications (such as billing or schedule-change notices) while you have an active account.</p>

<h2 id="s26"><span class="num">26.</span>Electronic Communications, Transactions, and Signatures</h2>
<p>Visiting the Site, using the App, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically satisfy any legal requirement that such communication be in writing.</p>

<h2 id="s27"><span class="num">27.</span>Prohibited Activities</h2>
<p>You may not access or use the Services for any purpose other than that for which we make the Services available. As a user of the Services, you agree not to:</p>
<ul>
<li>systematically retrieve data or other content from the Services to create or compile a collection or database;</li>
<li>trick, defraud, or mislead us or other users;</li>
<li>circumvent, disable, or otherwise interfere with security-related features of the Services;</li>
<li>disparage, tarnish, or otherwise harm, in our opinion, the Company or the Services;</li>
<li>use any information obtained from the Services to harass, abuse, or harm another person;</li>
<li>make improper use of our support services or submit false reports;</li>
<li>use the Services in a manner inconsistent with any applicable laws or regulations;</li>
<li>engage in unauthorised framing of or linking to the Services;</li>
<li>upload or transmit viruses, Trojan horses, or other harmful material;</li>
<li>engage in any automated use of the system; or</li>
<li>sell or otherwise transfer your account or profile.</li>
</ul>

<h2 id="s28"><span class="num">28.</span>User Generated Contributions</h2>
<p>The Services do not currently invite users to submit or post content for public display. If we introduce a feature that allows you to submit content ("Contributions"), any Contributions you transmit will be treated in accordance with our Privacy Policy.</p>

<h2 id="s29"><span class="num">29.</span>Contribution Licence</h2>
<p>You and the Company agree that we may access, store, process, and use any information and personal data that you provide in accordance with the terms of the Privacy Policy and your choices. We do not assert any ownership over your Contributions; you retain full ownership of all of your Contributions and any intellectual property rights associated with them.</p>

<h2 id="s30"><span class="num">30.</span>Mobile Application Licence</h2>
<p>If you access the Services via the App, we grant you a revocable, non-exclusive, non-transferable, limited right to install and use the App on wireless electronic devices owned or controlled by you, and to access and use the App strictly in accordance with these Legal Terms. With respect to the App, you shall not: decompile, reverse engineer, disassemble, or attempt to derive the source code of the App, except as permitted by applicable law; make any modification, adaptation, or derivative work of the App; use the App for any revenue-generating purpose outside its intended use; or remove, obscure, or alter any proprietary notices on the App. You may be required to create an account and provide certain information before you can download or use the App, and you are responsible for maintaining the confidentiality of that account. Your use of the App is also subject to the terms of use of the Apple App Store and/or Google Play, as applicable to the device on which you downloaded it.</p>

<h2 id="s31"><span class="num">31.</span>Third-Party Websites and Content</h2>
<p>The Site and App may contain links to other websites ("Third-Party Websites") as well as articles, photographs, text, graphics, or other content belonging to or originating from third parties. Such Third-Party Websites and content are not investigated, monitored, or checked for accuracy by us, and we are not responsible for any Third-Party Websites accessed through the Services or any content posted on, available through, or installed from them.</p>

<h2 id="s32"><span class="num">32.</span>Services Management</h2>
<p>We reserve the right, but not the obligation, to: monitor the Services for violations of these Legal Terms; take appropriate legal action against anyone who violates these Legal Terms; refuse, restrict, or limit access to any portion of the Services; and otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services.</p>

<h2 id="s33"><span class="num">33.</span>Corrections</h2>
<p>There may be information on the Services that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, and availability. We reserve the right to correct any errors, inaccuracies, or omissions, and to change or update the information on the Services at any time, without prior notice.</p>

<h2 id="s34"><span class="num">34.</span>Privacy Policy</h2>
<p>We care about data privacy and security. Please review our <a href="/privacy">Privacy Policy</a>. By using the Services, you agree to be bound by our Privacy Policy, which is incorporated into these Legal Terms.</p>

<h2 id="s35"><span class="num">35.</span>Disclaimer of Warranties</h2>
<p class="caps">The services are provided on an as-is and as-available basis. To the fullest extent permitted by law, we disclaim all warranties, express or implied, in connection with the services, including warranties of merchantability, fitness for a particular purpose, and non-infringement. We make no warranties or representations about the accuracy or completeness of the services' content and will assume no liability for any (1) errors, mistakes, or inaccuracies of content; (2) personal injury or property damage of any nature resulting from your access to or use of the services; (3) unauthorised access to or use of our secure servers or any personal information stored therein; (4) interruption or cessation of transmission to or from the services; or (5) bugs, viruses, or the like transmitted through the services.</p>
<p>This disclaimer relates to the Site, the App, and the general provision of the Services. Your assumption of risk and our release from liability for physical injury during training are separately governed by Section 10 (Assumption of Risk; Waiver and Release of Liability).</p>

<h2 id="s36"><span class="num">36.</span>Limitation of Liability</h2>
<p class="caps">In no event will we or our directors, employees, coaches, or agents be liable to you or any third party for any direct, indirect, consequential, exemplary, incidental, special, or punitive damages arising from your use of the services, even if we have been advised of the possibility of such damages. Notwithstanding anything to the contrary in these legal terms, and subject to section 10 (assumption of risk; waiver and release of liability), our liability to you will at all times be limited to the lesser of the amount paid by you to us during the six (6) month period prior to any cause of action arising, or $1,000.00 usd.</p>

<h2 id="s37"><span class="num">37.</span>Indemnification</h2>
<p>You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, Coaches, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys' fees and expenses, made by any third party due to or arising out of: your breach of these Legal Terms; your or the Participant's acts or omissions; your use of the Services; or, as described in Section 10.4, any claim brought by or on behalf of a minor Participant that is not otherwise validly released.</p>

<h2 id="s38"><span class="num">38.</span>User Data</h2>
<p>We will maintain certain data that you transmit to the Services for the purpose of managing the performance of the Services, as well as data relating to your use of the Services. Although we perform regular routine backups of data, you are solely responsible for all data that you transmit or that relates to any activity you have undertaken using the Services, and you agree that we have no liability to you for any loss or corruption of such data.</p>

<h2 id="s39"><span class="num">39.</span>Governing Law</h2>
<p>These Legal Terms and your use of the Services are governed by and construed in accordance with the laws of the State of Maryland, without regard to its conflict of law principles.</p>

<h2 id="s40"><span class="num">40.</span>Dispute Resolution</h2>
<h3>Binding Arbitration</h3>
<p>If the Parties are unable to resolve a dispute through informal negotiations, the dispute will be finally and exclusively resolved by binding arbitration under the Commercial Arbitration Rules of the American Arbitration Association. The arbitration will take place in Maryland, United States.</p>
<h3>Restrictions</h3>
<p>The Parties agree that any arbitration shall be limited to the dispute between the Parties individually. No arbitration shall be joined with any other proceeding, and there is no right for any dispute to be arbitrated on a class-action basis.</p>
<h3>Exceptions to Arbitration</h3>
<p>The Parties agree that disputes seeking to enforce intellectual property rights, disputes related to theft or invasion of privacy, claims for injunctive relief, and claims that qualify for small claims court are not subject to binding arbitration.</p>

<h2 id="s41"><span class="num">41.</span>California Users and Residents</h2>
<p>If any complaint with us is not satisfactorily resolved, you can contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, California 95834, or by telephone at (800) 952-5210 or (916) 445-1254.</p>

<h2 id="s42"><span class="num">42.</span>General Provisions</h2>
<p>These Legal Terms, together with our Privacy Policy and any policies or operating rules posted by us on the Services, constitute the entire agreement and understanding between you and us regarding the Services. Our failure to exercise or enforce any right or provision of these Legal Terms shall not operate as a waiver of such right or provision. If any provision of these Legal Terms is found to be unenforceable, the remaining provisions will remain in full force and effect. You may not assign these Legal Terms; we may assign them in connection with a merger, sale, or transfer of our business.</p>

<h2 id="s43"><span class="num">43.</span>Changes to These Terms</h2>
<p>We may update these Legal Terms at any time. We will post the updated Legal Terms on the Site and App with a new "Last Updated" date and, for material changes, notify you at the email on file. Continued use of the Services after the effective date of any changes means you accept the updated Legal Terms.</p>

<h2 id="s44"><span class="num">44.</span>Contact Us</h2>
<footer class="contact">
Next Star Soccer LLC<br>
5508 Ridgefield Road<br>
Bethesda, MD 20816<br>
United States<br>
Phone: 1-301-728-0764<br>
info@nextstarsoccer.com
</footer>

</div></body></html>`;

const TermsPage = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
      if (doc) {
        iframe.style.height = doc.documentElement.scrollHeight + 'px';
      }
    } catch {}
  };

  return (
    <div className="bg-black flex flex-col min-h-screen">
      <Navigation />
      <div className="pt-20 bg-white w-full">
        <iframe
          ref={iframeRef}
          srcDoc={termsHtml}
          title="Terms of Service"
          onLoad={handleLoad}
          scrolling="no"
          style={{ width: '100%', height: '0', border: 'none', display: 'block', overflow: 'hidden' }}
        />
      </div>
      <Footer />
    </div>
  );
};

export default TermsPage;
