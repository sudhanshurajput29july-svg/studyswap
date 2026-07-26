import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MainLayout from '../layouts/MainLayout';
import API, { getFileUrl } from '../services/api';
import { 
  MapPin, BookOpen, Plus, Trash2, Edit2, MessageSquare, MessageCircle, Loader, 
  Map, Compass, Search, Filter, RefreshCw, Layers, Check, Info, AlertCircle, Star,
  Image, Paperclip, FileText, Send, History, Shield, ArrowLeft
} from 'lucide-react';
import { io } from 'socket.io-client';



export default function NearbyExchange() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  
  // Tab states: 'discover' (browse books) vs 'my-books' (manage own listings)
  const [activeTab, setActiveTab] = useState('discover');
  
  // Book lists
  const [nearbyBooks, setNearbyBooks] = useState([]);
  const [myBooks, setMyBooks] = useState([]);
  
  // Loading & states
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [loadingMy, setLoadingMy] = useState(true);
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  const [locationStatus, setLocationStatus] = useState('detecting'); // 'detecting', 'success', 'denied'
  const [searchQuery, setSearchQuery] = useState('');
  const [maxDistance, setMaxDistance] = useState(15); // in km
  
  // Book Form State
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    description: '',
    genre: '',
    condition: 'Good',
    listingType: 'Exchange',
    price: ''
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  
  // Selected marker on map
  const [selectedOwner, setSelectedOwner] = useState(null);

  // Incoming exchange requests states
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [activeMeetupRequestId, setActiveMeetupRequestId] = useState(null);
  const [meetupLocation, setMeetupLocation] = useState('Library');
  const [customMeetupLocation, setCustomMeetupLocation] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [reportedUserId, setReportedUserId] = useState(null);

  // Review states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewedPeerName, setReviewedPeerName] = useState('');
  const [reviewedPeerId, setReviewedPeerId] = useState(null);

  // Exchange Chats specific states
  const [exchangeRooms, setExchangeRooms] = useState([]);
  const [activeExchangeRoom, setActiveExchangeRoom] = useState(null);
  const [exchangeMessages, setExchangeMessages] = useState([]);
  const [loadingExchangeRooms, setLoadingExchangeRooms] = useState(false);
  const [loadingExchangeMessages, setLoadingExchangeMessages] = useState(false);
  const [exchangeText, setExchangeText] = useState('');
  const exchangeSocketRef = useRef(null);
  const exchangeMessagesEndRef = useRef(null);
  const [exchangeUploading, setExchangeUploading] = useState(false);
  const exchangeFileInputRef = useRef(null);
  const exchangeImageInputRef = useRef(null);

  const [partnerStatus, setPartnerStatus] = useState('offline');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const [activeUsers, setActiveUsers] = useState({});
  const activeExchangeRoomRef = useRef(null);
  const [socket, setSocket] = useState(null);

  // History & Blocked Users states
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [exchangeHistory, setExchangeHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Live tracking states & refs
  const [showLiveTracker, setShowLiveTracker] = useState(false);
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [peerLocations, setPeerLocations] = useState({});

  const trackerMapContainerRef = useRef(null);
  const trackerMapRef = useRef(null);
  const trackerMarkersRef = useRef({});
  const geoWatcherRef = useRef(null);

  useEffect(() => {
    activeExchangeRoomRef.current = activeExchangeRoom;
  }, [activeExchangeRoom]);

  // Reset live tracking states when activeExchangeRoom changes
  useEffect(() => {
    setShareLiveLocation(false);
    setShowLiveTracker(false);
    setPeerLocations({});
  }, [activeExchangeRoom]);

  // Geolocation watchPosition tracker for sharing live location
  useEffect(() => {
    if (!activeExchangeRoom || !socket) return;

    if (shareLiveLocation) {
      if (navigator.geolocation) {
        geoWatcherRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const newLoc = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(newLoc);
            socket.emit('share-live-location', {
              roomId: activeExchangeRoom._id,
              userId: user?._id,
              location: newLoc
            });
          },
          (err) => console.error('Error watching location:', err),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      } else {
        alert('Geolocation is not supported by your browser.');
        setShareLiveLocation(false);
      }
    }

    return () => {
      if (geoWatcherRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatcherRef.current);
        geoWatcherRef.current = null;
      }
      if (socket && activeExchangeRoom) {
        socket.emit('stop-sharing-location', {
          roomId: activeExchangeRoom._id,
          userId: user?._id
        });
      }
    };
  }, [shareLiveLocation, activeExchangeRoom, socket]);

  // Cleanup tracker markers
  useEffect(() => {
    return () => {
      Object.values(trackerMarkersRef.current).forEach(marker => marker.setMap(null));
      trackerMarkersRef.current = {};
      trackerMapRef.current = null;
    };
  }, [showLiveTracker, activeExchangeRoom]);

  // Live Meetup Map Renderer
  useEffect(() => {
    if (!showLiveTracker || !trackerMapContainerRef.current || !window.google) return;

    const google = window.google;
    const partnerObj = getPartner(activeExchangeRoom);
    const partnerLoc = partnerObj ? peerLocations[partnerObj._id] : null;

    // 1. Initialize map if not already done
    if (!trackerMapRef.current) {
      const mapOptions = {
        center: userLocation || { lat: 28.6139, lng: 77.2090 },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
          { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
          { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] }
        ]
      };
      trackerMapRef.current = new google.maps.Map(trackerMapContainerRef.current, mapOptions);
    }

    const map = trackerMapRef.current;
    
    // Helper to create or update markers
    const updateMarker = (markerKey, position, title, isSelf) => {
      if (!position) {
        if (trackerMarkersRef.current[markerKey]) {
          trackerMarkersRef.current[markerKey].setMap(null);
          delete trackerMarkersRef.current[markerKey];
        }
        return;
      }

      const latLng = new google.maps.LatLng(position.lat, position.lng);
      
      if (!trackerMarkersRef.current[markerKey]) {
        const markerOptions = {
          position: latLng,
          map: map,
          title: title,
          icon: isSelf 
            ? {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }
            : {
                path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                fillColor: '#8b5cf6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 1,
                anchor: new google.maps.Point(12, 22),
                scale: 1.5
              }
        };
        trackerMarkersRef.current[markerKey] = new google.maps.Marker(markerOptions);
      } else {
        trackerMarkersRef.current[markerKey].setPosition(latLng);
      }
    };

    // Update self location
    updateMarker('self', userLocation, 'You (Live)', true);
    
    // Update peer location
    if (partnerObj) {
      updateMarker('peer', partnerLoc, `${partnerObj.name} (Live)`, false);
    }

    // Fit bounds if both coordinates exist
    if (userLocation && partnerLoc) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
      bounds.extend(new google.maps.LatLng(partnerLoc.lat, partnerLoc.lng));
      map.fitBounds(bounds);
      
      const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        if (map.getZoom() > 17) {
          map.setZoom(17);
        }
      });
    } else if (userLocation) {
      map.setCenter(new google.maps.LatLng(userLocation.lat, userLocation.lng));
      map.setZoom(16);
    }

  }, [showLiveTracker, userLocation, peerLocations, activeExchangeRoom]);

  const getDistanceInMeters = (loc1, loc2) => {
    if (!loc1 || !loc2) return null;
    const R = 6371e3; // Earth radius in metres
    const φ1 = loc1.lat * Math.PI / 180;
    const φ2 = loc2.lat * Math.PI / 180;
    const Δφ = (loc2.lat - loc1.lat) * Math.PI / 180;
    const Δλ = (loc2.lng - loc1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  };

  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalLocation, setProposalLocation] = useState('Library');
  const [proposalDateTime, setProposalDateTime] = useState('');
  const [proposalPrice, setProposalPrice] = useState('');

  // Google Maps dynamic script load references
  const mapContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const googleMapRef = useRef(null);
  const googleMarkersRef = useRef([]);

  useEffect(() => {
    detectLocation();
    fetchNearbyBooks();
    fetchMyBooks();
    fetchIncomingRequests();
  }, []);

  useEffect(() => {
    if (location.state && location.state.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  useEffect(() => {
    fetchNearbyBooks();
  }, [userLocation, maxDistance]);

  // Handle Canvas Drawing for Fallback Interactive Mock Map
  useEffect(() => {
    if (activeTab === 'discover' && canvasRef.current && userLocation && !window.google) {
      drawMockMap();
    }
  }, [activeTab, nearbyBooks, userLocation, selectedOwner]);

  // Handle Google Maps API Initialization
  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (activeTab === 'discover' && key && userLocation && mapContainerRef.current) {
      initGoogleMap(key);
    }
  }, [activeTab, userLocation, nearbyBooks]);

  // Consolidated real-time socket connection
  useEffect(() => {
    if (!user?._id) return;

    const socketUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace('/api', '') 
      : 'http://localhost:5000';
    
    const socketInstance = io(socketUrl);
    setSocket(socketInstance);
    exchangeSocketRef.current = socketInstance;
    socketInstance.emit('register-user', user._id);
    socketInstance.emit('get-online-users');

    // 1. Connection requests
    socketInstance.on('new-connection-request', (data) => {
      if (data.type === 'book') {
        setIncomingRequests(prev => {
          if (prev.some(req => req._id === data._id)) return prev;
          return [data, ...prev];
        });
      }
    });

    // 2. Real-time messages
    socketInstance.on('receive-message', (message) => {
      const currentRoom = activeExchangeRoomRef.current;
      const msgRoomId = message.chatRoom?._id || message.chatRoom;
      if (currentRoom && msgRoomId === currentRoom._id) {
        setExchangeMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
        API.put(`/chats/rooms/${currentRoom._id}/seen`).catch(console.error);
        setTimeout(() => {
          exchangeMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    });

    // 3. User status changes
    socketInstance.on('online-users-list', (userArray) => {
      const userMap = {};
      if (Array.isArray(userArray)) {
        userArray.forEach(id => {
          if (id) userMap[id.toString()] = 'online';
        });
      }
      setActiveUsers(prev => ({ ...prev, ...userMap }));
    });

    socketInstance.on('user-status-changed', (data) => {
      if (!data || !data.userId) return;
      const targetId = data.userId.toString();
      setActiveUsers(prev => ({
        ...prev,
        [targetId]: data.status
      }));
      
      const currentRoom = activeExchangeRoomRef.current;
      if (currentRoom) {
        const partner = currentRoom.participants?.find(p => (p._id?.toString() || p.toString()) !== user?._id?.toString());
        const partnerId = partner?._id?.toString() || partner?.toString();
        if (partnerId && partnerId === targetId) {
          setPartnerStatus(data.status);
        }
      }
    });

    socketInstance.on('user-status-response', (data) => {
      if (!data || !data.userId) return;
      const targetId = data.userId.toString();
      setActiveUsers(prev => ({
        ...prev,
        [targetId]: data.status
      }));
      
      const currentRoom = activeExchangeRoomRef.current;
      if (currentRoom) {
        const partner = currentRoom.participants?.find(p => (p._id?.toString() || p.toString()) !== user?._id?.toString());
        const partnerId = partner?._id?.toString() || partner?.toString();
        if (partnerId && partnerId === targetId) {
          setPartnerStatus(data.status);
        }
      }
    });

    // 4. Typing indicator
    socketInstance.on('typing', (data) => {
      const currentRoom = activeExchangeRoomRef.current;
      if (currentRoom && data.roomId === currentRoom._id) {
        setIsTyping(true);
      }
    });

    socketInstance.on('stop-typing', (data) => {
      const currentRoom = activeExchangeRoomRef.current;
      if (currentRoom && data.roomId === currentRoom._id) {
        setIsTyping(false);
      }
    });

    // 5. Messages seen
    socketInstance.on('messages-seen', (data) => {
      const currentRoom = activeExchangeRoomRef.current;
      if (currentRoom && data.roomId === currentRoom._id) {
        setExchangeMessages((prev) =>
          prev.map((msg) => (msg.sender === user?._id || msg.sender?._id === user?._id ? { ...msg, seen: true } : msg))
        );
      }
    });

    // 6. Proposal updates
    socketInstance.on('proposal-updated', (updatedMsg) => {
      const currentRoom = activeExchangeRoomRef.current;
      if (currentRoom && updatedMsg.chatRoom._id === currentRoom._id) {
        setExchangeMessages((prev) =>
          prev.map((msg) => (msg._id === updatedMsg._id ? updatedMsg : msg))
        );
        if (updatedMsg.proposal.proposalStatus === 'accepted') {
          if (userLocation) fetchNearbyBooks();
          fetchMyBooks();
        }
      }
    });

    // 7. Live meetup tracking
    socketInstance.on('peer-live-location', (data) => {
      const currentRoom = activeExchangeRoomRef.current;
      if (currentRoom && data.roomId === currentRoom._id) {
        setPeerLocations((prev) => ({
          ...prev,
          [data.userId]: data.location
        }));
      }
    });

    socketInstance.on('peer-stopped-sharing', (data) => {
      const currentRoom = activeExchangeRoomRef.current;
      if (currentRoom && data.roomId === currentRoom._id) {
        setPeerLocations((prev) => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      }
    });

    return () => {
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [user]);

  // Query online status for nearby book owners
  useEffect(() => {
    if (nearbyBooks.length > 0 && socket) {
      socket.emit('get-online-users');
      const ownerIds = [...new Set(nearbyBooks.map(b => b.owner?._id?.toString()).filter(Boolean))];
      ownerIds.forEach(id => {
        socket.emit('get-user-status', id);
      });
    }
  }, [nearbyBooks, socket]);

  // Query online status for exchange chat partners
  useEffect(() => {
    if (exchangeRooms.length > 0 && socket) {
      socket.emit('get-online-users');
      exchangeRooms.forEach(room => {
        const partner = room.participants?.find(p => (p._id?.toString() || p.toString()) !== user?._id?.toString());
        if (partner) {
          const partnerId = partner._id?.toString() || partner.toString();
          socket.emit('get-user-status', partnerId);
        }
      });
    }
  }, [exchangeRooms, socket]);

  // Fetch lists when respective tabs become active
  useEffect(() => {
    if (activeTab === 'chats') {
      fetchExchangeRooms();
    } else if (activeTab === 'blocked') {
      fetchBlockedUsers();
    } else if (activeTab === 'history') {
      fetchExchangeHistory();
    }
  }, [activeTab]);

  // Detect user position using browser Geolocation
  const detectLocation = () => {
    setLocationStatus('detecting');
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      // Fallback coordinates: IMS Engineering College, Ghaziabad (28.6644, 77.5132)
      updateLocationOnBackend(28.6644, 77.5132);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateLocationOnBackend(latitude, longitude);
      },
      (error) => {
        console.warn('Geolocation access denied. Falling back to default coordinates.');
        setLocationStatus('denied');
        // Fallback coordinates: IMS Engineering College, Ghaziabad (28.6644, 77.5132)
        updateLocationOnBackend(28.6644, 77.5132);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const updateLocationOnBackend = async (lat, lng) => {
    setUserLocation({ lat, lng });
    setLocationStatus('success');
    try {
      await API.put('/users/location', { latitude: lat, longitude: lng });
    } catch (e) {
      console.error('Failed to update geolocation on server:', e);
    }
  };

  const fetchNearbyBooks = async () => {
    setLoadingNearby(true);
    try {
      const distanceParam = Number(maxDistance) === 100 ? 20000000 : Number(maxDistance) * 1000;
      const response = await API.get(`/books/nearby?maxDistance=${distanceParam}`);
      const data = response.data.data || [];
      setNearbyBooks(data);
    } catch (e) {
      console.error('Failed to load nearby books:', e);
    } finally {
      setLoadingNearby(false);
    }
  };

  const fetchMyBooks = async () => {
    setLoadingMy(true);
    try {
      const response = await API.get('/books/my');
      setMyBooks(response.data.data || []);
    } catch (e) {
      console.error('Failed to load my books:', e);
    } finally {
      setLoadingMy(false);
    }
  };

  const fetchIncomingRequests = async () => {
    setLoadingRequests(true);
    try {
      const response = await API.get('/connections/list');
      const requests = response.data.data.incomingRequests || [];
      setIncomingRequests(requests.filter(req => req.type === 'book'));
    } catch (e) {
      console.error('Failed to load incoming book requests:', e);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchBlockedUsers = async () => {
    setLoadingBlocked(true);
    try {
      const response = await API.get('/users/blocked');
      setBlockedUsers(response.data.data || []);
    } catch (e) {
      console.error('Failed to fetch blocked users:', e);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const fetchExchangeHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await API.get('/books/exchange-history');
      setExchangeHistory(response.data.data || []);
    } catch (e) {
      console.error('Failed to fetch exchange history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleUnblock = async (blockedId) => {
    try {
      await API.post(`/users/unblock/${blockedId}`);
      fetchBlockedUsers();
      if (userLocation) fetchNearbyBooks();
    } catch (e) {
      console.error('Failed to unblock user:', e);
      alert('Failed to unblock user.');
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await API.put(`/connections/accept/${requestId}`);
      fetchIncomingRequests();
      setActiveTab('chats');
      fetchExchangeRooms();
    } catch (e) {
      console.error('Failed to accept exchange request:', e);
      alert('Failed to accept request. Please try again.');
    }
  };

  const triggerMeetupModal = (requestId) => {
    setActiveMeetupRequestId(requestId);
    setMeetupLocation('Library');
    setCustomMeetupLocation('');
  };

  const handleConfirmMeetup = async () => {
    const finalLocation = meetupLocation === 'Custom' ? customMeetupLocation : meetupLocation;
    if (meetupLocation === 'Custom' && !customMeetupLocation.trim()) {
      alert('Please enter a custom location name.');
      return;
    }

    try {
      await API.put(`/connections/accept/${activeMeetupRequestId}`, {
        meetupLocation: finalLocation
      });
      fetchIncomingRequests();
      setActiveMeetupRequestId(null);
      setActiveTab('chats');
      fetchExchangeRooms();
    } catch (e) {
      console.error('Failed to accept exchange request with meetup:', e);
      alert('Failed to schedule exchange meetup. Please try again.');
    }
  };

  const handleReserveBook = async (book) => {
    try {
      await API.put(`/books/${book._id}`, { status: 'Reserved' });
      
      // Notify the owner of the book reservation
      try {
        await API.post(`/connections/request/${book.owner._id}`, {
          type: 'book',
          bookTitle: `Reserved: "${book.title}"`
        });
      } catch (connErr) {
        console.log('Notification for reservation skipped/bypassed:', connErr.message);
      }

      alert(`🎉 Success! You have reserved "${book.title}". The owner has been notified.`);
      if (userLocation) fetchNearbyBooks();
    } catch (e) {
      console.error('Failed to reserve book:', e);
      alert('Failed to reserve book. Please try again.');
    }
  };

  const handleUpdateBookStatus = async (bookId, newStatus) => {
    try {
      await API.put(`/books/${bookId}`, { status: newStatus });
      fetchMyBooks();
      if (userLocation) fetchNearbyBooks();
    } catch (e) {
      console.error('Failed to update book status:', e);
      alert('Failed to update book status. Please try again.');
    }
  };

  const triggerReviewModalQuick = (peerId, peerName) => {
    setReviewedPeerId(peerId);
    setReviewedPeerName(peerName);
    setReviewRating(5);
    setReviewComment('');
    setShowReviewModal(true);
  };

  const handleReviewSubmitQuick = async (e) => {
    e.preventDefault();
    try {
      await API.post(`/users/${reviewedPeerId}/reviews`, {
        rating: reviewRating,
        comment: reviewComment
      });
      alert(`Thank you! Your review for ${reviewedPeerName} has been submitted.`);
      setShowReviewModal(false);
    } catch (err) {
      console.error('Failed to submit peer review:', err);
      alert('Failed to submit review. Please try again.');
    }
  };

  const fetchExchangeRooms = async () => {
    setLoadingExchangeRooms(true);
    try {
      const res = await API.get('/chats/rooms?type=book');
      const list = res.data.data || [];
      setExchangeRooms(list);
      if (list.length > 0 && !activeExchangeRoom) {
        selectExchangeRoom(list[0]);
      }
    } catch (e) {
      console.error('Failed to fetch exchange chats:', e);
    } finally {
      setLoadingExchangeRooms(false);
    }
  };

  const selectExchangeRoom = async (room) => {
    setActiveExchangeRoom(room);
    setLoadingExchangeMessages(true);
    if (socket) {
      socket.emit('join-chat', room._id);
    }
    try {
      const res = await API.get(`/chats/rooms/${room._id}/messages`);
      setExchangeMessages(res.data.data || []);
      setTimeout(() => {
        exchangeMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      console.error('Failed to load room messages:', e);
    } finally {
      setLoadingExchangeMessages(false);
    }
  };

  const handleSendExchangeMessage = async (e) => {
    if (e) e.preventDefault();
    if (!exchangeText.trim() || !activeExchangeRoom) return;

    const textToSend = exchangeText.trim();
    setExchangeText('');

    try {
      const res = await API.post(`/chats/rooms/${activeExchangeRoom._id}/messages`, {
        content: textToSend
      });
      const newMsg = res.data.data;
      setExchangeMessages((prev) => {
        if (prev.some((m) => m._id === newMsg._id)) return prev;
        return [...prev, newMsg];
      });

      setTimeout(() => {
        exchangeMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } catch (err) {
      console.error('Failed to send exchange message:', err);
      // Restore text if sending failed
      setExchangeText(textToSend);
    }
  };

  const handleExchangeFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeExchangeRoom) return;

    const formData = new FormData();
    formData.append('file', file);
    
    let type = 'notes';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type === 'application/pdf') type = 'pdf';
    formData.append('messageType', type);

    setExchangeUploading(true);
    try {
      const response = await API.post(`/chats/rooms/${activeExchangeRoom._id}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const { fileUrl, fileName, messageType } = response.data.data;
      
      const res = await API.post(`/chats/rooms/${activeExchangeRoom._id}/messages`, {
        content: `Shared resource: ${fileName}`,
        messageType: messageType,
        fileUrl: fileUrl,
        fileName: fileName
      });

      const newMsg = res.data.data;
      setExchangeMessages((prev) => {
        if (prev.some((m) => m._id === newMsg._id)) return prev;
        return [...prev, newMsg];
      });
      setTimeout(() => {
        exchangeMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } catch (err) {
      console.error('Exchange file upload failed:', err);
      alert('File upload failed. Please try again.');
    } finally {
      setExchangeUploading(false);
      if (exchangeFileInputRef.current) exchangeFileInputRef.current.value = '';
      if (exchangeImageInputRef.current) exchangeImageInputRef.current.value = '';
    }
  };

  const handleInputChange = (val) => {
    setExchangeText(val);

    if (exchangeSocketRef.current && activeExchangeRoom) {
      exchangeSocketRef.current.emit('typing', {
        roomId: activeExchangeRoom._id,
        userId: user?._id,
        name: user?.name
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        exchangeSocketRef.current.emit('stop-typing', {
          roomId: activeExchangeRoom._id,
          userId: user?._id
        });
      }, 2000);
    }
  };

  const handleSendProposal = async (e) => {
    e.preventDefault();
    if (!activeExchangeRoom) return;

    try {
      const priceVal = proposalPrice ? Number(proposalPrice) : activeExchangeRoom.book?.price || 0;
      
      const res = await API.post(`/chats/rooms/${activeExchangeRoom._id}/messages`, {
        messageType: 'proposal',
        content: `Proposed meetup at ${proposalLocation} on ${proposalDateTime || 'as agreed'} for price ₹${priceVal}`,
        proposal: {
          location: proposalLocation,
          dateTime: proposalDateTime || 'As coordinated',
          price: priceVal,
          proposalStatus: 'pending'
        }
      });

      const newMsg = res.data.data;
      setExchangeMessages((prev) => {
        if (prev.some((m) => m._id === newMsg._id)) return prev;
        return [...prev, newMsg];
      });
      setShowProposalForm(false);
      setProposalDateTime('');
      setProposalPrice('');
    } catch (err) {
      console.error('Failed to send exchange proposal:', err);
    }
  };

  const handleUpdateProposal = async (messageId, status, counteredPrice) => {
    try {
      const res = await API.put(`/chats/messages/${messageId}/proposal`, {
        status,
        price: counteredPrice
      });

      setExchangeMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? res.data.data : msg))
      );

      if (status === 'accepted') {
        alert('🎉 Exchange Confirmed! Listing marked as Exchanged.');
        if (userLocation) fetchNearbyBooks();
        fetchMyBooks();
      }
    } catch (err) {
      console.error('Failed to update proposal status:', err);
    }
  };

  // Join room effect
  useEffect(() => {
    if (activeExchangeRoom && socket) {
      socket.emit('join-chat', activeExchangeRoom._id);

      const partnerObj = getPartner(activeExchangeRoom);
      if (partnerObj) {
        socket.emit('get-user-status', partnerObj._id?.toString());
      }

      API.put(`/chats/rooms/${activeExchangeRoom._id}/seen`)
        .then(() => {
          setExchangeMessages((prev) =>
            prev.map((msg) => {
              const msgSenderId = msg.sender?._id || msg.sender;
              return msgSenderId?.toString() === user?._id?.toString() ? msg : { ...msg, seen: true };
            })
          );
        })
        .catch(console.error);
    }
  }, [activeExchangeRoom, socket]);

  // Consolidated chat-tab effect replaced by consolidated mount effect

  const handleBlockUserQuick = async (targetId, targetName) => {
    if (!window.confirm(`Are you sure you want to block ${targetName}? Their book pins will disappear from your map.`)) return;
    try {
      await API.post(`/users/block/${targetId}`);
      alert(`${targetName} has been blocked.`);
      setSelectedOwner(null);
      if (userLocation) fetchNearbyBooks();
    } catch (e) {
      console.error('Failed to block user:', e);
      alert('Failed to block user.');
    }
  };

  const triggerReportModalQuick = (targetId) => {
    setReportedUserId(targetId);
    setReportReason('Harassment');
    setReportDetails('');
    setShowReportModal(true);
  };

  const handleReportSubmitQuick = async (e) => {
    e.preventDefault();
    try {
      await API.post(`/users/report/${reportedUserId}`, {
        reason: reportReason,
        details: reportDetails
      });
      alert('Report submitted successfully. Thank you for keeping StudySwap safe.');
      setShowReportModal(false);
    } catch (err) {
      console.error('Failed to submit report:', err);
      alert('Failed to submit report. Please try again.');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await API.put(`/connections/reject/${requestId}`);
      fetchIncomingRequests();
    } catch (e) {
      console.error('Failed to reject exchange request:', e);
      alert('Failed to ignore request. Please try again.');
    }
  };

  // Google Maps setup helper
  const initGoogleMap = (apiKey) => {
    if (window.google) {
      renderGoogleMarkers();
      return;
    }

    const existingScript = document.getElementById('google-maps-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.id = 'google-maps-script';
      script.async = true;
      script.onload = () => setupGoogleMapInstance();
      document.body.appendChild(script);
    } else {
      setupGoogleMapInstance();
    }
  };

  const setupGoogleMapInstance = () => {
    const google = window.google;
    if (!google || !mapContainerRef.current || !userLocation) return;

    const mapOptions = {
      center: userLocation,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
        { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
        { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] }
      ]
    };

    googleMapRef.current = new google.maps.Map(mapContainerRef.current, mapOptions);
    renderGoogleMarkers();
  };

  const renderGoogleMarkers = () => {
    const google = window.google;
    if (!google || !googleMapRef.current) return;

    // Clear old markers
    googleMarkersRef.current.forEach(marker => marker.setMap(null));
    googleMarkersRef.current = [];

    // Current user marker (Blue)
    const userMarker = new google.maps.Marker({
      position: userLocation,
      map: googleMapRef.current,
      title: 'You (Current Location)',
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff'
      }
    });
    googleMarkersRef.current.push(userMarker);

    // Group nearby books by owner
    const ownersMap = {};
    nearbyBooks.forEach(book => {
      if (!book.owner || !book.owner.location) return;
      const ownerId = book.owner._id;
      if (!ownersMap[ownerId]) {
        ownersMap[ownerId] = {
          name: book.owner.name,
          coords: {
            lat: book.owner.location.coordinates[1],
            lng: book.owner.location.coordinates[0]
          },
          college: book.owner.profile?.college || 'Campus Student',
          rating: book.owner.reputation?.score || '0.0',
          distance: book.distance !== undefined ? book.distance : null,
          email: book.owner.email,
          avatar: book.owner.profile?.avatar || '',
          bio: book.owner.profile?.bio || '',
          course: book.owner.profile?.course || '',
          books: []
        };
      }
      ownersMap[ownerId].books.push(book);
    });

    // Create markers for other users with books
    Object.keys(ownersMap).forEach(ownerId => {
      const ownerData = ownersMap[ownerId];
      const marker = new google.maps.Marker({
        position: ownerData.coords,
        map: googleMapRef.current,
        title: ownerData.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#ffffff'
        }
      });

      marker.addListener('click', () => {
        setSelectedOwner({
          _id: ownerId,
          name: ownerData.name,
          coords: ownerData.coords,
          college: ownerData.college,
          rating: ownerData.rating,
          distance: ownerData.distance,
          email: ownerData.email,
          avatar: ownerData.avatar,
          bio: ownerData.bio,
          course: ownerData.course,
          books: ownerData.books
        });
      });

      googleMarkersRef.current.push(marker);
    });
  };

  // Drawing Mock Map Fallback Canvas
  const drawMockMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // Draw Grid Background (simulating map tiles)
    ctx.fillStyle = '#0f172a'; // dark-950 slate
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e293b'; // slate-800 grid lines
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Center coordinates for user
    const cx = width / 2;
    const cy = height / 2;

    // Draw scale circles for distance (e.g. 5km, 10km, 15km)
    ctx.strokeStyle = '#334155/30';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);

    [100, 180, 260].forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(51, 65, 85, ${0.4 - idx * 0.1})`;
      ctx.stroke();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '9px Plus Jakarta Sans';
      ctx.fillText(`${(idx + 1) * 5} km`, cx + r + 5, cy + 3);
    });
    ctx.setLineDash([]); // reset dashes

    // Group nearby books by owner
    const ownersMap = {};
    nearbyBooks.forEach(book => {
      if (!book.owner || !book.owner.location) return;
      const ownerId = book.owner._id;
      if (!ownersMap[ownerId]) {
        ownersMap[ownerId] = {
          name: book.owner.name,
          coords: book.owner.location.coordinates,
          college: book.owner.profile?.college || 'Campus Student',
          rating: book.owner.reputation?.score || '0.0',
          distance: book.distance !== undefined ? book.distance : null,
          email: book.owner.email,
          avatar: book.owner.profile?.avatar || '',
          bio: book.owner.profile?.bio || '',
          course: book.owner.profile?.course || '',
          books: []
        };
      }
      ownersMap[ownerId].books.push(book);
    });

    // Draw user dot (Blue pulsing dot)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Plus Jakarta Sans';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', cx, cy - 12);

    // Draw Student Book Pins (Green)
    Object.keys(ownersMap).forEach(ownerId => {
      const owner = ownersMap[ownerId];
      // Convert longitude/latitude deltas to canvas offsets relative to user location
      // Using an arbitrary multiplier for visible visual scaling on the grid
      const lonDelta = owner.coords[0] - userLocation.lng;
      const latDelta = owner.coords[1] - userLocation.lat;

      const px = cx + (lonDelta * 25000);
      const py = cy - (latDelta * 25000); // subtract since lat increases upwards

      // Draw outer indicator ring
      const isSelected = selectedOwner && selectedOwner._id === ownerId;
      if (isSelected) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.beginPath();
        ctx.arc(px, py, 20, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Draw Book pin
      ctx.fillStyle = isSelected ? '#34d399' : '#10b981';
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Render short label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 10px Outfit';
      ctx.fillText(owner.name, px, py - 12);

      // Save click area targets dynamically
      owner.canvasX = px;
      owner.canvasY = py;
    });

    // Save ownersMap to window or reference for mouse interactions
    canvas.owners = ownersMap;
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.owners) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let clickedAny = false;
    Object.keys(canvas.owners).forEach(ownerId => {
      const owner = canvas.owners[ownerId];
      const dist = Math.sqrt((x - owner.canvasX) ** 2 + (y - owner.canvasY) ** 2);
      if (dist < 15) { // clicked near pin
        setSelectedOwner({
          _id: ownerId,
          name: owner.name,
          coords: owner.coords,
          college: owner.college,
          rating: owner.rating,
          distance: owner.distance,
          email: owner.email,
          avatar: owner.avatar,
          bio: owner.bio,
          course: owner.course,
          books: owner.books
        });
        clickedAny = true;
      }
    });

    if (!clickedAny) {
      setSelectedOwner(null);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setSelectedImage(URL.createObjectURL(file));
    }
  };

  // Submit book listing
  const handleAddBookSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const { title, author, description, genre, condition, listingType, price } = bookForm;
    if (!title || !author) {
      setFormError('Title and Author are required fields.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('author', author);
      formData.append('description', description || '');
      formData.append('genre', genre || '');
      formData.append('condition', condition);
      formData.append('listingType', listingType);
      if (listingType === 'Sell') {
        formData.append('price', price);
      }
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const response = await API.post('/books', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setFormSuccess('Book listed successfully!');
      setBookForm({ title: '', author: '', description: '', genre: '', condition: 'Good', listingType: 'Exchange', price: '' });
      setSelectedImage(null);
      setImageFile(null);
      fetchMyBooks();
      if (userLocation) fetchNearbyBooks();
      setTimeout(() => {
        setIsAddingBook(false);
        setFormSuccess('');
      }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to list book. Try again.');
    }
  };

  // Delete book listing
  const handleDeleteBook = async (id) => {
    if (!window.confirm('Are you sure you want to remove this book listing?')) return;
    try {
      await API.delete(`/books/${id}`);
      fetchMyBooks();
      if (userLocation) fetchNearbyBooks();
    } catch (e) {
      console.error('Failed to delete book:', e);
    }
  };

  // Initiate Chat session to request exchange
  const handleRequestExchange = async (book) => {
    if (book.owner._id.startsWith('mock-')) {
      alert(`📚 [DEMO MODE] Exchange Requested!\n\nBook: "${book.title}"\nOwner: ${book.owner.name}\n\nIn a live environment with other active students, this action will automatically create a chat room and send an exchange inquiry message to coordinate a meetup!`);
      return;
    }
    try {
      // 1. Trigger connection request notification (fails silently if already connected)
      try {
        await API.post(`/connections/request/${book.owner._id}`, {
          type: 'book',
          bookTitle: book.title
        });
      } catch (connErr) {
        console.log('Connection request already exists or bypassed:', connErr.message);
      }

      // 2. Create/Get direct chat room with owner
      const response = await API.post('/chats/room', {
        recipientId: book.owner._id,
        isGroup: false,
        isBookExchange: true
      });
      
      const room = response.data.data;
      
      // 2. Post automated system request message
      await API.post(`/chats/rooms/${room._id}/messages`, {
        content: `📚 [BOOK EXCHANGE REQUEST] Hi! I'm interested in your book "${book.title}" by ${book.author} listed as "${book.condition}" condition. Can we coordinate a meetup to exchange it?`
      });

      // 3. Set tab and active room directly
      setActiveTab('chats');
      fetchExchangeRooms();
      selectExchangeRoom(room);
    } catch (err) {
      console.error('Failed to coordinate book exchange chat:', err);
      alert('Failed to connect with the owner. Please try again.');
    }
  };

  const filteredNearbyBooks = nearbyBooks.filter(book => {
    const query = searchQuery.toLowerCase();
    return (
      book.title.toLowerCase().includes(query) ||
      book.author.toLowerCase().includes(query) ||
      (book.genre && book.genre.toLowerCase().includes(query))
    );
  });

  const getPartner = (room) => {
    if (!room || !room.participants) return null;
    return room.participants.find(p => p._id?.toString() !== user?._id?.toString());
  };

  const partner = getPartner(activeExchangeRoom);
  const isPartnerOnline = partner && activeUsers[partner._id?.toString()] === 'online';
  const partnerName = partner ? partner.name : 'Study Peer';

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-dark-900 px-6 py-5 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm text-left gap-4">
          <div className="flex items-center space-x-3 font-bold text-slate-900 dark:text-white">
            <div className="p-2 bg-gradient-purple text-white rounded-xl shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl tracking-tight font-extrabold">Nearby Book Exchange</h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Trade textbooks and study guides with nearby students</p>
            </div>
          </div>
          
          {/* Navigation Tab toggles */}
          <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap bg-slate-100 dark:bg-dark-950 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/80 max-w-full">
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
                activeTab === 'discover'
                  ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Discover Nearby</span>
            </button>
            <button
              onClick={() => setActiveTab('my-books')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
                activeTab === 'my-books'
                  ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>My Listings ({myBooks.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 relative ${
                activeTab === 'requests'
                  ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Exchange Requests ({incomingRequests.length})</span>
              {incomingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 relative ${
                activeTab === 'chats'
                  ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Exchange Chats ({exchangeRooms.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 relative ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Completed History</span>
            </button>
            <button
              onClick={() => setActiveTab('blocked')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 relative ${
                activeTab === 'blocked'
                  ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Blocked Users</span>
            </button>
          </div>
        </div>

        {/* Tab 1: DISCOVER MAP VIEW */}
        {activeTab === 'discover' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Filter & Book Lists Panel */}
            <div className="lg:col-span-4 space-y-5 text-left h-auto lg:h-[620px] flex flex-col justify-between">
              
              {/* Search & Distance controls */}
              <div className="glass p-5 rounded-2xl border border-white/20 shadow-sm space-y-4">
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, author, genre..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center"><Compass className="w-3.5 h-3.5 mr-1" /> Max Distance</span>
                    <span className="text-primary-600 dark:text-primary-400">
                      {Number(maxDistance) === 100 ? 'All (Global)' : `${maxDistance} km`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(e.target.value)}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 flex items-center">
                    <Info className="w-3.5 h-3.5 mr-1 text-slate-500" /> 
                    {locationStatus === 'success' ? 'Location verified' : 'Using default location'}
                  </span>
                  <button 
                    onClick={detectLocation}
                    className="text-primary-600 dark:text-primary-400 hover:underline flex items-center space-x-1 font-bold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Recenter</span>
                  </button>
                </div>
              </div>

              {/* Book Results List */}
              <div className="glass p-5 rounded-2xl border border-white/20 shadow-sm flex-1 mt-4 overflow-y-auto space-y-4 max-h-[420px]">
                <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 flex justify-between items-center">
                  <span>Available Books Nearby</span>
                  <span className="bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                    {filteredNearbyBooks.length} Books
                  </span>
                </h3>

                {loadingNearby ? (
                  <div className="flex flex-col justify-center items-center py-16 space-y-3">
                    <Loader className="w-6 h-6 text-primary-500 animate-spin" />
                    <span className="text-xs text-slate-400">Locating books nearby...</span>
                  </div>
                ) : filteredNearbyBooks.length === 0 ? (
                  <div className="text-center py-16 space-y-2">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500">No books found matching criteria within {maxDistance}km.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {filteredNearbyBooks.map(book => (
                      <div 
                        key={book._id} 
                        className={`p-3.5 rounded-xl border transition-all ${
                          selectedOwner && selectedOwner._id === book.owner?._id
                            ? 'bg-primary-50/40 dark:bg-primary-950/15 border-primary-300 dark:border-primary-900/40 shadow-sm'
                            : 'bg-white/40 dark:bg-dark-900/40 border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          {book.image && (
                            <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-dark-950 border border-slate-200/50 dark:border-slate-800/80">
                              <img src={getFileUrl(book.image)} alt={book.title} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-1">
                              <div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{book.title}</h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">By {book.author}</p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {book.genre && (
                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-dark-800 text-[10px] font-medium text-slate-600 dark:text-slate-300 rounded">
                                      {book.genre}
                                    </span>
                                  )}
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                    book.condition === 'New' || book.condition === 'Like New'
                                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
                                      : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20'
                                  }`}>
                                    {book.condition}
                                  </span>
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center ${
                                    book.listingType === 'Sell'
                                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                                      : book.listingType === 'Donate'
                                        ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/20'
                                        : 'bg-blue-50 text-blue-600 dark:bg-blue-950/20'
                                  }`}>
                                    {book.listingType === 'Sell' ? `💰 Sell (₹${book.price})` : book.listingType === 'Donate' ? '🎁 Donate' : '🔄 Exchange'}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Distance tag */}
                              {book.distance !== null && (
                                <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20 px-2 py-0.5 rounded-md flex items-center shrink-0">
                                  <MapPin className="w-3 h-3 mr-0.5" /> {book.distance} km
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-850 mt-3 pt-3">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 flex items-center space-x-1.5">
                            <span>Owner:</span>
                            <span className="text-slate-900 dark:text-white font-extrabold">{book.owner?.name}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center space-x-1 ${
                                activeUsers[book.owner?._id?.toString()] === 'online'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-100 dark:bg-dark-800 text-slate-400 border border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${activeUsers[book.owner?._id?.toString()] === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                              <span>{activeUsers[book.owner?._id?.toString()] === 'online' ? 'Online' : 'Offline'}</span>
                            </span>
                          </span>
                          <div className="flex items-center space-x-1.5">
                            {book.status === 'Available' ? (
                              <>
                                <button
                                  onClick={() => handleReserveBook(book)}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-extrabold rounded-lg shadow-sm transition-colors"
                                >
                                  Reserve
                                </button>
                                <button
                                  onClick={() => handleRequestExchange(book)}
                                  className="px-2.5 py-1 bg-gradient-purple text-white text-[10px] font-extrabold rounded-lg shadow-sm hover:opacity-90 flex items-center space-x-1"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>Request</span>
                                </button>
                              </>
                            ) : book.status === 'Reserved' ? (
                              <>
                                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-lg flex items-center">
                                  🔒 Reserved
                                </span>
                                <button
                                  onClick={() => handleRequestExchange(book)}
                                  className="px-2.5 py-1 bg-gradient-purple text-white text-[10px] font-extrabold rounded-lg shadow-sm hover:opacity-90 flex items-center space-x-1"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>Request</span>
                                </button>
                              </>
                            ) : (
                              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-lg flex items-center">
                                🤝 Exchanged
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Map Canvas & Location Selection Panel */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Main Map Box */}
              <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden h-72 sm:h-96 lg:h-[620px]">

                {/* Google Maps Container */}
                {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
                  <div ref={mapContainerRef} className="w-full h-full bg-slate-900" />
                ) : (
                  // Interactive Canvas Mock Map
                  <canvas 
                    ref={canvasRef}
                    width={800}
                    height={620}
                    onClick={handleCanvasClick}
                    className="w-full h-full cursor-pointer transition-all active:scale-[0.99]"
                  />
                )}

                {/* Map Bottom Left Overlay Details if marker clicked */}
                {selectedOwner && (
                  <div className="absolute bottom-5 left-5 right-5 bg-white/95 dark:bg-dark-900/95 backdrop-blur-md p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-20 text-left max-w-md animate-slideUp">
                    <div className="flex justify-between items-start pb-2.5 border-b border-slate-100 dark:border-slate-850">
                       <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                          <span>{selectedOwner.name}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center space-x-1 ${
                              activeUsers[selectedOwner._id?.toString()] === 'online'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-100 dark:bg-dark-800 text-slate-400 border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${activeUsers[selectedOwner._id?.toString()] === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span>{activeUsers[selectedOwner._id?.toString()] === 'online' ? 'Online' : 'Offline'}</span>
                          </span>
                          <span className="text-[10px] text-amber-500 font-bold">
                            ⭐ {selectedOwner.reputation?.score || '0.0'}
                          </span>
                        </h4>
                        <div className="flex space-x-2 text-[9px] font-bold text-slate-400 mt-1">
                          <button
                            onClick={() => handleBlockUserQuick(selectedOwner._id, selectedOwner.name)}
                            className="text-red-500 hover:underline"
                          >
                            Block
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            onClick={() => triggerReportModalQuick(selectedOwner._id)}
                            className="text-amber-600 hover:underline"
                          >
                            Report
                          </button>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedOwner(null)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-bold bg-slate-100 dark:bg-dark-800 p-1.5 rounded-lg"
                      >
                        Close
                      </button>
                    </div>
                    
                    <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                      {selectedOwner.books.map(book => (
                        <div key={book._id} className="flex items-center text-xs p-2 bg-slate-50 dark:bg-dark-950/60 rounded-xl border border-slate-100 dark:border-slate-850 gap-2.5">
                          {book.image && (
                            <div className="w-9 h-12 rounded overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-dark-950 border border-slate-200/50 dark:border-slate-800/80">
                              <img src={getFileUrl(book.image)} alt={book.title} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{book.title}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              By {book.author} | {book.condition} | <span className="font-bold text-primary-500">{book.listingType === 'Sell' ? `💰 Sell (₹${book.price})` : book.listingType === 'Donate' ? '🎁 Donate' : '🔄 Exchange'}</span>
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            {book.status === 'Available' ? (
                              <>
                                <button
                                  onClick={() => handleReserveBook(book)}
                                  className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded text-[9px] transition-colors"
                                >
                                  Reserve
                                </button>
                                <button
                                  onClick={() => handleRequestExchange(book)}
                                  className="px-2 py-0.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded text-[9px] shadow-sm flex items-center space-x-1"
                                >
                                  <MessageSquare className="w-2.5 h-2.5" />
                                  <span>Request</span>
                                </button>
                              </>
                            ) : book.status === 'Reserved' ? (
                              <>
                                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold rounded text-[9px]">
                                  Reserved
                                </span>
                                <button
                                  onClick={() => handleRequestExchange(book)}
                                  className="px-2 py-0.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded text-[9px] shadow-sm flex items-center space-x-1"
                                >
                                  <MessageSquare className="w-2.5 h-2.5" />
                                  <span>Request</span>
                                </button>
                              </>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded text-[9px]">
                                Exchanged
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: MY BOOK LISTINGS */}
        {activeTab === 'my-books' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start text-left">
            
            {/* Add Book Form Card */}
            <div className="glass p-6 rounded-2xl border border-white/20 shadow-lg space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center">
                  <Plus className="w-4 h-4 mr-1 text-primary-500" /> List a Book
                </h3>
                {isAddingBook && (
                  <button 
                    onClick={() => setIsAddingBook(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center space-x-1">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAddBookSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Book Title *</label>
                  <input
                    type="text"
                    required
                    value={bookForm.title}
                    onChange={(e) => setBookForm({...bookForm, title: e.target.value})}
                    placeholder="e.g. Introduction to Algorithms"
                    className="w-full px-3 py-2 bg-white dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Author *</label>
                  <input
                    type="text"
                    required
                    value={bookForm.author}
                    onChange={(e) => setBookForm({...bookForm, author: e.target.value})}
                    placeholder="e.g. Thomas H. Cormen"
                    className="w-full px-3 py-2 bg-white dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Genre / Subject</label>
                    <input
                      type="text"
                      value={bookForm.genre}
                      onChange={(e) => setBookForm({...bookForm, genre: e.target.value})}
                      placeholder="e.g. CS / DSA"
                      className="w-full px-3 py-2 bg-white dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Condition</label>
                    <select
                      value={bookForm.condition}
                      onChange={(e) => setBookForm({...bookForm, condition: e.target.value})}
                      className="w-full px-3 py-2 bg-white dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                    >
                      <option value="New">New</option>
                      <option value="Like New">Like New</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Listing Type</label>
                    <select
                      value={bookForm.listingType}
                      onChange={(e) => setBookForm({...bookForm, listingType: e.target.value})}
                      className="w-full px-3 py-2 bg-white dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                    >
                      <option value="Exchange">🔄 Exchange</option>
                      <option value="Sell">💰 Sell</option>
                      <option value="Donate">🎁 Donate</option>
                    </select>
                  </div>

                  {bookForm.listingType === 'Sell' && (
                    <div className="space-y-1 animate-fadeIn">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={bookForm.price}
                        onChange={(e) => setBookForm({...bookForm, price: e.target.value})}
                        placeholder="e.g. 299"
                        className="w-full px-3 py-2 bg-white dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Book Cover Image</label>
                  {selectedImage ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 h-28 flex items-center justify-center bg-slate-50 dark:bg-dark-950">
                      <img src={selectedImage} alt="Preview" className="h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => { setSelectedImage(null); setImageFile(null); }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-primary-500 dark:hover:border-primary-500 rounded-xl p-3 cursor-pointer transition-colors bg-slate-50/50 dark:bg-dark-950/30">
                      <Image className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-[10px] font-bold text-slate-500">Upload Book Cover</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">JPG, PNG, JPEG</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Description</label>
                  <textarea
                    value={bookForm.description}
                    onChange={(e) => setBookForm({...bookForm, description: e.target.value})}
                    placeholder="Provide condition details or specific study course requirements..."
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-purple text-white text-xs font-bold rounded-xl shadow-md hover:opacity-95 transition-opacity"
                >
                  Create Listing
                </button>
              </form>
            </div>

            {/* My Active Listings List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="glass p-6 rounded-2xl border border-white/20 shadow-lg">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-850 pb-3 flex justify-between items-center">
                  <span>My Active Listings</span>
                  <span className="bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 px-2.5 py-0.5 rounded-lg text-xs font-bold">
                    {myBooks.length} Listings
                  </span>
                </h3>

                {loadingMy ? (
                  <div className="flex flex-col justify-center items-center py-20">
                    <Loader className="w-6 h-6 text-primary-500 animate-spin" />
                  </div>
                ) : myBooks.length === 0 ? (
                  <div className="text-center py-20 space-y-2">
                    <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500">You haven't listed any books for exchange yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {myBooks.map(book => (
                      <div key={book._id} className="p-4 bg-white/40 dark:bg-dark-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl flex flex-col justify-between space-y-3">
                        <div className="flex items-start space-x-3">
                          {book.image && (
                            <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-dark-950 border border-slate-200/50 dark:border-slate-800/80">
                              <img src={getFileUrl(book.image)} alt={book.title} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex justify-between items-start gap-1">
                              <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{book.title}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider shrink-0 ${
                                book.status === 'Available'
                                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
                                  : book.status === 'Reserved'
                                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                                    : 'bg-slate-100 text-slate-500 dark:bg-dark-800'
                              }`}>
                                {book.status}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">By {book.author}</span>
                            <p className="text-[10px] text-slate-500 line-clamp-2 mt-1.5">{book.description || 'No description provided.'}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-850 mt-2">
                          <div className="flex space-x-1">
                            {book.status !== 'Available' && (
                              <button
                                onClick={() => handleUpdateBookStatus(book._id, 'Available')}
                                className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold rounded-md transition-colors"
                              >
                                Re-list
                              </button>
                            )}
                            {book.status !== 'Reserved' && book.status !== 'Exchanged' && (
                              <button
                                onClick={() => handleUpdateBookStatus(book._id, 'Reserved')}
                                className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold rounded-md transition-colors"
                              >
                                Reserve
                              </button>
                            )}
                            {book.status !== 'Exchanged' && (
                              <button
                                onClick={() => handleUpdateBookStatus(book._id, 'Exchanged')}
                                className="px-2 py-0.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold rounded-md transition-colors"
                              >
                                Exchanged
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteBook(book._id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                            title="Remove Listing"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: EXCHANGE REQUESTS */}
        {activeTab === 'requests' && (
          <div className="glass p-6 rounded-2xl border border-white/20 shadow-sm text-left space-y-4">
            <div>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-slate-400">Incoming Exchange Requests</h2>
              <p className="text-xs text-slate-500 mt-1">Review connection requests from students interested in your books</p>
            </div>

            {loadingRequests ? (
              <div className="flex flex-col justify-center items-center py-20 space-y-3">
                <Loader className="w-6 h-6 text-primary-500 animate-spin" />
                <span className="text-xs text-slate-400">Loading incoming requests...</span>
              </div>
            ) : incomingRequests.length === 0 ? (
              <div className="text-center py-20 space-y-2">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">No pending exchange requests at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {incomingRequests.map(req => (
                  <div key={req._id} className="p-4 bg-white/40 dark:bg-dark-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl flex flex-col justify-between space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-purple text-white font-bold flex items-center justify-center text-sm shadow-sm">
                          {req.requester?.name?.charAt(0).toUpperCase() || 'S'}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-dark-900 ${
                            activeUsers[req.requester?._id?.toString()] === 'online'
                              ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-400/30'
                              : 'bg-slate-400'
                          }`}
                        />
                      </div>
                      <div className="space-y-0.5 text-left flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">{req.requester?.name}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center space-x-1 ${
                              activeUsers[req.requester?._id?.toString()] === 'online'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-100 dark:bg-dark-800 text-slate-400 border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${activeUsers[req.requester?._id?.toString()] === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span>{activeUsers[req.requester?._id?.toString()] === 'online' ? 'Online' : 'Offline'}</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Wants your book: <strong className="text-primary-600 dark:text-primary-400 font-bold">"{req.bookTitle}"</strong>
                        </p>
                        <span className="text-[10px] text-slate-400 block pt-1">
                          Requested {new Date(req.createdAt).toLocaleDateString()} at {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                      <button
                        onClick={() => triggerMeetupModal(req._id)}
                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center justify-center space-x-1 shadow-sm transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> <span>Accept & Chat</span>
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req._id)}
                        className="flex-1 py-2 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> <span>Ignore</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: EMBEDDED EXCHANGE CHATS */}
        {activeTab === 'chats' && (
          <div className="glass rounded-2xl border border-white/20 shadow-lg text-left overflow-hidden h-[620px] flex">
            {/* Left sidebar: Active Rooms list */}
            <div className={`${activeExchangeRoom ? 'hidden md:flex md:w-80' : 'w-full md:w-80'} border-r border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-dark-900/40 flex flex-col h-full`}>
              <div className="p-4 border-b border-slate-100 dark:border-slate-850">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Exchange Workspaces</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Active book discussions</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadingExchangeRooms ? (
                  <div className="flex justify-center py-10">
                    <Loader className="w-5 h-5 text-primary-500 animate-spin" />
                  </div>
                ) : exchangeRooms.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10 italic">No book exchange chats active yet.</p>
                ) : (
                  exchangeRooms.map((room) => {
                    const isSelected = activeExchangeRoom && activeExchangeRoom._id === room._id;
                    const partnerObj = getPartner(room);
                    const roomName = partnerObj ? partnerObj.name : 'Study Peer';
                    const bookTitle = room.book ? room.book.title : 'Book Negotiation';
                    const isPartnerOnlineInRoom = partnerObj && activeUsers[partnerObj._id?.toString()] === 'online';
                    return (
                      <div
                        key={room._id}
                        onClick={() => selectExchangeRoom(room)}
                        className={`w-full p-3 rounded-xl flex items-center justify-between cursor-pointer border transition-colors ${
                          isSelected
                            ? 'bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 border-primary-100 dark:border-primary-900/20 shadow-sm'
                            : 'hover:bg-slate-100 dark:hover:bg-dark-900/50 text-slate-700 dark:text-slate-300 border-transparent'
                        }`}
                      >
                        <div className="flex items-center space-x-3 overflow-hidden flex-1">
                          <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 rounded-xl bg-gradient-purple flex items-center justify-center text-white text-sm font-bold shadow-sm">
                              {roomName.charAt(0).toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-dark-900 ${
                                isPartnerOnlineInRoom
                                  ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-400/30'
                                  : 'bg-slate-400 dark:bg-slate-600'
                              }`}
                              title={isPartnerOnlineInRoom ? 'Online' : 'Offline'}
                            />
                          </div>
                          <div className="text-left overflow-hidden flex-1">
                            <div className="flex items-center justify-between">
                              <span className="truncate font-extrabold text-xs">{roomName}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center space-x-1 flex-shrink-0 ml-1.5 ${
                                  isPartnerOnlineInRoom
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-slate-100 dark:bg-dark-800 text-slate-400 border border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isPartnerOnlineInRoom ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                <span>{isPartnerOnlineInRoom ? 'Online' : 'Offline'}</span>
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                              📚 {bookTitle}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right container: Message Feed */}
            <div className={`${!activeExchangeRoom ? 'hidden md:flex' : 'flex'} flex-1 flex flex-col bg-slate-50 dark:bg-dark-950/60 h-full relative`}>
              {activeExchangeRoom ? (
                <>
                  {/* Header info */}
                  <div className="px-3 sm:px-6 py-3 bg-white dark:bg-dark-900/80 border-b border-slate-200 dark:border-slate-800/80 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center space-x-2 sm:space-x-3 overflow-hidden">
                      <button
                        onClick={() => setActiveExchangeRoom(null)}
                        className="md:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 flex-shrink-0"
                        title="Back to Workspaces"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-purple flex items-center justify-center text-white text-sm font-bold shadow-sm">
                          {(partnerName).charAt(0).toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-dark-900 ${
                            isPartnerOnline
                              ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-400/30'
                              : 'bg-slate-400 dark:bg-slate-600'
                          }`}
                          title={isPartnerOnline ? 'Online' : 'Offline'}
                        />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                            {partnerName}
                          </h4>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center space-x-1.5 ${
                              isPartnerOnline
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isPartnerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span>{isPartnerOnline ? 'Online' : 'Offline'}</span>
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">
                          Book Swap Workspace
                        </p>
                      </div>
                    </div>

                    {/* Safety & Rating actions */}
                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      <button
                        onClick={() => setShowLiveTracker((prev) => !prev)}
                        className={`py-1.5 px-2.5 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-all shadow-sm ${
                          showLiveTracker 
                            ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse' 
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        }`}
                        title="Track Live Location during meetup"
                      >
                        <span>📍</span>
                        <span>{showLiveTracker ? 'Close Map' : 'Track Live'}</span>
                      </button>
                      <button
                        onClick={() => {
                          if (partner) triggerReviewModalQuick(partner._id?.toString(), partner.name);
                        }}
                        className="p-1.5 text-slate-400 hover:text-amber-500 rounded hover:bg-slate-100 dark:hover:bg-dark-800 flex items-center justify-center"
                        title="Rate Study Peer"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      </button>
                      <button
                        onClick={() => {
                          if (partner) handleBlockUserQuick(partner._id?.toString(), partner.name);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 dark:hover:bg-dark-800 flex items-center justify-center font-bold text-xs"
                        title="Block User"
                      >
                        🔒
                      </button>
                      <button
                        onClick={() => {
                          if (partner) triggerReportModalQuick(partner._id?.toString());
                        }}
                        className="p-1.5 text-slate-400 hover:text-amber-500 rounded hover:bg-slate-100 dark:hover:bg-dark-800 flex items-center justify-center font-bold text-xs"
                        title="Report User"
                      >
                        🚩
                      </button>
                    </div>
                  </div>

                  {/* Live Location Tracker Widget */}
                  {showLiveTracker && (() => {
                    const partnerObj = getPartner(activeExchangeRoom);
                    const partnerLoc = partnerObj ? peerLocations[partnerObj._id] : null;
                    const distance = getDistanceInMeters(userLocation, partnerLoc);
                    const isPartnerSharing = !!partnerLoc;

                    return (
                      <div className="bg-slate-100 dark:bg-dark-900 border-b border-slate-200 dark:border-slate-800 p-4 space-y-3 animate-slideDown">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex flex-col text-left">
                            <strong className="text-slate-800 dark:text-slate-200 font-extrabold text-sm flex items-center space-x-1.5">
                              <span>📍 Meet-up Live Tracker</span>
                              {shareLiveLocation && (
                                <span className="flex h-2 w-2 relative">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                              )}
                            </strong>
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              Coordinate your meetup point in real-time.
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <label className="flex items-center space-x-1.5 cursor-pointer bg-white dark:bg-dark-950 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 shadow-sm text-[10px]">
                              <input
                                type="checkbox"
                                checked={shareLiveLocation}
                                onChange={(e) => setShareLiveLocation(e.target.checked)}
                                className="rounded text-primary-600 focus:ring-primary-500 border-slate-350"
                              />
                              <span className="font-extrabold text-slate-700 dark:text-slate-300">
                                {shareLiveLocation ? 'Sharing location live' : 'Share my location'}
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Map Container */}
                        <div ref={trackerMapContainerRef} className="w-full h-[220px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-205 dark:bg-dark-955" />

                        {/* Tracker status footer */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 bg-white/40 dark:bg-dark-955/20 py-2 rounded-lg border border-slate-100 dark:border-slate-850/50">
                          <div className="flex items-center space-x-2 text-left">
                            <span className="font-bold text-slate-600 dark:text-slate-300">Peer Location Sharing:</span>
                            <span className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] ${
                              isPartnerSharing 
                                ? 'bg-emerald-500/10 text-emerald-600' 
                                : 'bg-slate-500/10 text-slate-500'
                            }`}>
                              {isPartnerSharing ? 'Live Tracking Connected' : 'Waiting for Peer to Share'}
                            </span>
                          </div>

                          {isPartnerSharing && distance !== null && (
                            <div className="font-extrabold text-primary-600 dark:text-primary-400 flex items-center space-x-1">
                              <span>Distance:</span>
                              <span className="bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded border border-primary-100/30 text-[10px]">
                                {distance < 1000 ? `${Math.round(distance)} meters` : `${(distance / 1000).toFixed(1)} km`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Pinned Book Card */}
                  {activeExchangeRoom.book && (
                    <div className="bg-gradient-to-r from-primary-500/10 to-indigo-500/10 dark:from-primary-950/20 dark:to-indigo-950/20 p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs animate-slideDown">
                      <div className="flex items-center space-x-3 text-left">
                        <div className="w-9 h-11 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center font-bold text-primary-500 rounded-md shadow-sm">
                          📚
                        </div>
                        <div>
                          <strong className="text-slate-800 dark:text-slate-200 font-extrabold text-sm block">
                            {activeExchangeRoom.book.title}
                          </strong>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Author: {activeExchangeRoom.book.author} | Condition: {activeExchangeRoom.book.condition}
                          </span>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="px-2 py-0.5 bg-primary-600/10 text-primary-600 font-bold rounded-full text-[9px]">
                              {activeExchangeRoom.book.listingType || 'Exchange'}
                            </span>
                            {activeExchangeRoom.book.listingType === 'Sell' && (
                              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 font-bold rounded-full text-[9px]">
                                ₹{activeExchangeRoom.book.price}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 font-bold rounded-full text-[9px] ${
                              activeExchangeRoom.book.status === 'Available' 
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : activeExchangeRoom.book.status === 'Reserved'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-slate-500/10 text-slate-650'
                            }`}>
                              {activeExchangeRoom.book.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons inside Pinned Card */}
                      <div className="flex items-center space-x-2">
                        {activeExchangeRoom.book.status === 'Available' ? (
                          <button
                            onClick={() => handleReserveBook(activeExchangeRoom.book)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-lg shadow-sm"
                          >
                            Reserve Book
                          </button>
                        ) : activeExchangeRoom.book.status === 'Reserved' && (
                          <button
                            onClick={async () => {
                              try {
                                await API.put(`/books/${activeExchangeRoom.book._id}`, { status: 'Available' });
                                alert('Reservation cancelled successfully!');
                                if (userLocation) fetchNearbyBooks();
                                fetchMyBooks();
                              } catch(e) {
                                alert('Failed to cancel reservation.');
                              }
                            }}
                            className="px-2.5 py-1 bg-slate-200 dark:bg-dark-800 hover:bg-slate-300 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 font-extrabold rounded-lg"
                          >
                            Cancel Reservation
                          </button>
                        )}
                        <button
                          onClick={() => setShowProposalForm(!showProposalForm)}
                          className="px-2.5 py-1 bg-primary-600 hover:bg-primary-750 text-white font-extrabold rounded-lg shadow-sm"
                        >
                          {showProposalForm ? 'Close Offer' : '💰 Make Deal Offer'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Proposal Form overlay */}
                  {showProposalForm && (
                    <form onSubmit={handleSendProposal} className="bg-white dark:bg-dark-900 p-4 border-b border-slate-200 dark:border-slate-800 text-xs text-left space-y-3 animate-slideDown flex-shrink-0">
                      <h4 className="font-extrabold text-slate-800 dark:text-slate-200">Create Deal Proposal</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Location</label>
                          <select
                            value={proposalLocation}
                            onChange={(e) => setProposalLocation(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none text-slate-800 dark:text-slate-205"
                          >
                            <option value="Library">Library 📚</option>
                            <option value="College Gate">College Gate 🏫</option>
                            <option value="Cafeteria">Cafeteria ☕</option>
                            <option value="Metro Station">Metro Station 🚇</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Preferred Date & Time</label>
                          <input
                            type="datetime-local"
                            value={proposalDateTime}
                            onChange={(e) => setProposalDateTime(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none text-slate-800 dark:text-slate-205"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Offered Price (₹)</label>
                          <input
                            type="number"
                            value={proposalPrice}
                            onChange={(e) => setProposalPrice(e.target.value)}
                            placeholder={activeExchangeRoom.book?.price || '0'}
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none text-slate-800 dark:text-slate-205"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowProposalForm(false)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 font-bold rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-primary-600 hover:bg-primary-750 text-white font-extrabold rounded-lg shadow-md"
                        >
                          Send Deal Proposal
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Message feed list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingExchangeMessages ? (
                      <div className="flex justify-center py-20">
                        <Loader className="w-6 h-6 text-primary-500 animate-spin" />
                      </div>
                    ) : (
                      exchangeMessages.map((msg, idx) => {
                        const isOwn = msg.sender?._id === user?._id || msg.sender === user?._id;
                        const senderName = msg.sender?.name || 'Student';

                        if (msg.messageType === 'proposal') {
                          const prop = msg.proposal;
                          const isOwnProposal = msg.sender?._id === user?._id || msg.sender === user?._id;
                          return (
                            <div key={idx} className={`flex items-end space-x-2 ${isOwnProposal ? 'justify-end' : 'justify-start'}`}>
                              {!isOwnProposal && (
                                <div className="w-6 h-6 rounded-lg bg-indigo-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                                  {senderName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="max-w-sm">
                                <div className={`p-4 rounded-2xl shadow-md border leading-relaxed text-xs text-left space-y-2.5 ${
                                  isOwnProposal
                                    ? 'bg-slate-100 border-slate-200 dark:bg-dark-900 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                                    : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                                }`}>
                                  <div className="flex items-center space-x-1.5 text-primary-500 font-bold border-b pb-1.5">
                                    <span>🤝 Deal Negotiation Offer</span>
                                  </div>
                                  <div className="space-y-1 text-slate-700 dark:text-slate-350">
                                    <p>📍 <strong>Meetup Point:</strong> {prop.location}</p>
                                    <p>📅 <strong>Proposed Time:</strong> {prop.dateTime ? new Date(prop.dateTime).toLocaleString() : 'As agreed'}</p>
                                    <p>💰 <strong>Deal Price:</strong> <span className="text-sm font-extrabold text-amber-500">₹{prop.price}</span></p>
                                  </div>
                                  
                                  {/* Status indicator */}
                                  <div className="pt-1.5 border-t flex justify-between items-center">
                                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg ${
                                      prop.proposalStatus === 'accepted'
                                        ? 'bg-emerald-500/10 text-emerald-600'
                                        : prop.proposalStatus === 'rejected'
                                        ? 'bg-red-500/10 text-red-650'
                                        : 'bg-amber-500/10 text-amber-600'
                                    }`}>
                                      {prop.proposalStatus === 'accepted' ? '✅ Accepted' : prop.proposalStatus === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                                    </span>

                                    {/* Action buttons for recipient of proposal */}
                                    {!isOwnProposal && prop.proposalStatus === 'pending' && (
                                      <div className="flex space-x-1.5">
                                        <button
                                          onClick={() => handleUpdateProposal(msg._id, 'rejected')}
                                          className="px-2 py-0.5 bg-red-100 dark:bg-red-950/20 hover:bg-red-200 text-red-600 text-[10px] font-bold rounded"
                                        >
                                          Reject
                                        </button>
                                        <button
                                          onClick={() => handleUpdateProposal(msg._id, 'accepted', prop.price)}
                                          className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-extrabold rounded shadow-sm"
                                        >
                                          Accept Offer
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1 mt-1 justify-end">
                                  <span className="text-[8px] text-slate-400">
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {isOwn && (
                                    <span className="text-[10px] text-primary-500">
                                      {msg.seen ? '✓✓' : '✓'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={idx} className={`flex items-end space-x-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            {!isOwn && (
                              <div className="w-6 h-6 rounded-lg bg-indigo-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                                {senderName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="max-w-xs">
                              <div className={`p-2.5 rounded-xl shadow-sm text-xs leading-relaxed ${
                                isOwn
                                  ? 'bg-primary-600 text-white rounded-br-none'
                                  : 'bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'
                              }`}>
                                {msg.messageType === 'notes' ? (
                                  <pre className="font-sans whitespace-pre-wrap leading-relaxed">{msg.content}</pre>
                                ) : msg.messageType === 'image' ? (
                                  <div className="space-y-2">
                                    <img src={getFileUrl(msg.fileUrl)} alt="Shared Resource" className="max-w-full rounded-xl max-h-40 object-contain bg-black/5" />
                                    <a href={getFileUrl(msg.fileUrl)} target="_blank" rel="noreferrer" className="text-[10px] underline block opacity-85">Open Full Image</a>
                                  </div>
                                ) : msg.messageType === 'pdf' ? (
                                  <div className="flex items-center space-x-3 p-2 bg-black/10 dark:bg-white/10 rounded-lg">
                                    <FileText className="w-8 h-8 text-red-400" />
                                    <div className="text-left overflow-hidden flex-1">
                                      <p className="text-[10px] font-bold truncate max-w-32">{msg.fileName || 'Document.pdf'}</p>
                                      <a href={getFileUrl(msg.fileUrl)} target="_blank" rel="noreferrer" className="text-[9px] underline block mt-0.5">Download PDF</a>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="whitespace-pre-wrap">{msg.content}</p>
                                )}
                              </div>
                              <div className="flex items-center space-x-1 mt-1 justify-end">
                                <span className="text-[8px] text-slate-400">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {isOwn && (
                                  <span className="text-[10px] text-primary-500">
                                    {msg.seen ? '✓✓' : '✓'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {isTyping && (
                      <div className="flex items-center space-x-2 text-slate-400 italic text-[10px] animate-pulse py-1">
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[8px]">
                          💬
                        </div>
                        <span>Partner is typing...</span>
                      </div>
                    )}
                    <div ref={exchangeMessagesEndRef} />
                  </div>

                  {/* Input form */}
                  <form onSubmit={handleSendExchangeMessage} className="p-2 sm:p-4 bg-white dark:bg-dark-900 border-t border-slate-200 dark:border-slate-800/80 flex flex-col flex-shrink-0 z-20">
                    {exchangeUploading && (
                      <div className="mb-2 px-3 py-1 bg-primary-50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/30 rounded-xl flex items-center space-x-2 text-[10px] text-primary-600 dark:text-primary-400">
                        <Loader className="w-3.5 h-3.5 text-primary-500 animate-spin" />
                        <span>Uploading attachment... Please wait.</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1.5 sm:space-x-3 bg-slate-50 dark:bg-dark-950 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-inner w-full overflow-hidden">
                      {/* Image attach button */}
                      <button
                        type="button"
                        onClick={() => exchangeImageInputRef.current?.click()}
                        className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-dark-900 transition-colors shrink-0"
                        title="Share Photo / Image"
                        disabled={exchangeUploading}
                      >
                        <Image className="w-4 h-4 sm:w-5 sm:h-5" />
                        <input type="file" ref={exchangeImageInputRef} onChange={handleExchangeFileUpload} className="hidden" accept="image/*" />
                      </button>

                      {/* File attach button */}
                      <button
                        type="button"
                        onClick={() => exchangeFileInputRef.current?.click()}
                        className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-dark-900 transition-colors shrink-0"
                        title="Attach Notes or PDF"
                        disabled={exchangeUploading}
                      >
                        <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                        <input type="file" ref={exchangeFileInputRef} onChange={handleExchangeFileUpload} className="hidden" accept="application/pdf,text/plain" />
                      </button>

                      <input
                        type="text"
                        value={exchangeText}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder="Type a negotiation message..."
                        className="flex-1 min-w-0 py-1.5 px-2 sm:px-3 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                        disabled={exchangeUploading}
                      />

                      <button
                        type="submit"
                        disabled={exchangeUploading}
                        className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-primary-600 hover:bg-primary-700 active:scale-95 text-white rounded-xl shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-50"
                        title="Send Message"
                      >
                        <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex flex-col justify-center items-center flex-1 space-y-2.5 text-slate-400">
                  <MessageSquare className="w-12 h-12" />
                  <p className="text-xs">Select a workspace from the sidebar to start chat</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: COMPLETED HISTORY */}
        {activeTab === 'history' && (
          <div className="glass p-6 rounded-2xl border border-white/20 shadow-lg text-left max-w-4xl mx-auto space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                <History className="w-5 h-5 text-primary-500" />
                <span>Exchange History</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">Review your completed textbook exchanges and sales</p>
            </div>

            {loadingHistory ? (
              <div className="flex justify-center py-10">
                <Loader className="w-6 h-6 text-primary-500 animate-spin" />
              </div>
            ) : exchangeHistory.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-10 text-center">You haven't completed any exchanges yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {exchangeHistory.map((hist) => {
                  const isOwner = hist.owner?._id === user._id;
                  const partyName = isOwner ? hist.recipient?.name : hist.owner?.name;
                  const typeLabel = hist.listingType === 'Sell' ? `Sold (₹${hist.price})` : hist.listingType === 'Donate' ? 'Donated' : 'Exchanged';

                  return (
                    <div key={hist._id} className="py-4 flex justify-between items-center text-xs">
                      <div>
                        <strong className="text-slate-900 dark:text-white text-sm">"{hist.bookTitle}"</strong>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1">
                          Mode: <span className="font-bold text-primary-500">{typeLabel}</span> | {isOwner ? `Recipient: ${partyName}` : `Sender: ${partyName}`}
                        </span>
                        {hist.meetupLocation && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">📍 Meetup: {hist.meetupLocation}</span>
                        )}
                      </div>
                      <span className="text-slate-400 dark:text-slate-550 text-[10px]">
                        {new Date(hist.completedAt).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: BLOCKED USERS */}
        {activeTab === 'blocked' && (
          <div className="glass p-6 rounded-2xl border border-white/20 shadow-lg text-left max-w-4xl mx-auto space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                <Shield className="w-5 h-5 text-rose-500" />
                <span>Blocked Users Settings</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">Manage blocked study profiles to restore messaging and book swaps</p>
            </div>

            {loadingBlocked ? (
              <div className="flex justify-center py-10">
                <Loader className="w-6 h-6 text-primary-500 animate-spin" />
              </div>
            ) : blockedUsers.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-10 text-center font-medium">You haven't blocked any users yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {blockedUsers.map((blocked) => (
                  <div key={blocked._id} className="p-4 bg-white/40 dark:bg-dark-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-dark-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-350 uppercase">
                        {blocked.name.charAt(0)}
                      </div>
                      <div>
                        <strong className="text-xs text-slate-900 dark:text-white block">{blocked.name}</strong>
                        <span className="text-[10px] text-slate-400 dark:text-slate-550 block">{blocked.email}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnblock(blocked._id)}
                      className="px-2.5 py-1 border border-primary-300 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/20 text-[10px] font-bold rounded-lg transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Choose Meetup Location Modal overlay */}
        {activeMeetupRequestId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4 text-left animate-scaleUp">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center">
                <MapPin className="w-5 h-5 mr-1.5 text-primary-500" /> Choose Meet-up Location
              </h3>
              <p className="text-xs text-slate-500">Select a meeting point on campus to exchange the book with the requester.</p>
              
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2">
                  {['Library', 'College Gate', 'Metro Station', 'Cafeteria'].map(loc => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setMeetupLocation(loc)}
                      className={`p-3 text-xs font-bold rounded-xl border text-center transition-all ${
                        meetupLocation === loc
                          ? 'bg-primary-50/50 border-primary-500 text-primary-600 dark:bg-primary-950/20'
                          : 'bg-slate-50 dark:bg-dark-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {loc === 'Library' && '📚 '}
                      {loc === 'College Gate' && '🚪 '}
                      {loc === 'Metro Station' && '🚉 '}
                      {loc === 'Cafeteria' && '☕ '}
                      {loc}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMeetupLocation('Custom')}
                    className={`col-span-2 p-3 text-xs font-bold rounded-xl border text-center transition-all ${
                      meetupLocation === 'Custom'
                        ? 'bg-primary-50/50 border-primary-500 text-primary-600 dark:bg-primary-950/20'
                        : 'bg-slate-50 dark:bg-dark-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    📍 Custom Location...
                  </button>
                </div>

                {meetupLocation === 'Custom' && (
                  <div className="space-y-1 animate-fadeIn">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Custom Location Name</label>
                    <input
                      type="text"
                      required
                      value={customMeetupLocation}
                      onChange={(e) => setCustomMeetupLocation(e.target.value)}
                      placeholder="e.g. Block C Lawn"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                <button
                  onClick={() => setActiveMeetupRequestId(null)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmMeetup}
                  className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  Confirm & Chat
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Report User Modal overlay */}
        {showReportModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <form onSubmit={handleReportSubmitQuick} className="w-full max-w-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4 text-left">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center">
                <Flag className="w-5 h-5 mr-1.5 text-amber-500" /> Report User
              </h3>
              <p className="text-xs text-slate-500">Provide details about the issue. Our moderators will review this report within 24 hours.</p>

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Reason</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none text-slate-850 dark:text-slate-100"
                  >
                    <option value="Harassment">Harassment</option>
                    <option value="Spam">Spam</option>
                    <option value="Inappropriate Content">Inappropriate Content</option>
                    <option value="Fake Listing">Fake Listing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Details / Description</label>
                  <textarea
                    required
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Describe the issue or specify the fake listings..."
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none text-slate-855 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rate Study Peer Modal overlay */}
        {showReviewModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <form onSubmit={handleReviewSubmitQuick} className="w-full max-w-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4 text-left animate-scaleUp">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center">
                <Star className="w-5 h-5 mr-1.5 text-amber-500 fill-amber-500" /> Rate & Review Peer
              </h3>
              <p className="text-xs text-slate-500">Share your swap experience with <strong>{reviewedPeerName}</strong> to help maintain a trusted campus community.</p>

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Rating (1-5 Stars)</label>
                  <div className="flex space-x-1 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star className={`w-6 h-6 ${star <= reviewRating ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-750'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Review Feedback</label>
                  <textarea
                    required
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Was the meeting location safe? Was the book in described condition?"
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none text-slate-855 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary-600 hover:bg-primary-750 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
